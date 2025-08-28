class PostsController < ApplicationController
  before_action :authenticate_user!, except: [:index, :show]
  before_action :set_post, only: [:show, :edit, :update, :destroy]
  before_action :authorize_user!, only: [:edit, :update, :destroy]

  def index
    if user_signed_in?
      following_ids = current_user.following_ids
      
      if following_ids.any?
        # Основная лента подписок
        @feed_posts = Post.joins(:user)
                        .where(user_id: following_ids + [current_user.id])
                        .includes(:user, image_attachment: :blob)
                        .order(created_at: :desc)
        
        # Рекомендации - исключаем уже подписанных пользователей
        @recommended_posts = recommended_posts.limit(5)
        @show_recommendations = true
      else
        # Нет подписок - показываем только рекомендации
        @feed_posts = recommended_posts
        @show_recommendations = true
      end
    else
      # Для незалогиненных пользователей
      @feed_posts = recommended_posts
      @show_recommendations = true
    end
    
    @posts = @feed_posts
  end

  # показываем пост в модалке
  def show
    respond_to do |format|
      format.html { render partial: "posts/modal", locals: { post: @post } }
    end
  end

  def search
    @query = params[:query]
    @posts = Post.search(@query)
  end

  def new
    @post = current_user.posts.build
  end

  def create
    @post = current_user.posts.build(post_params)

    if @post.save
      respond_to do |format|
        format.turbo_stream 
        format.html { redirect_to root_path, notice: "Пост опубликован" }
      end
    else
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace("newPostContainer", 
            partial: "posts/form", 
            locals: { post: @post }
          )
        end
        format.html { render :new, status: :unprocessable_entity }
      end
    end
  end

  def edit
    respond_to do |format|
      format.html { render :edit, locals: { post: @post } }
      format.turbo_stream
    end
  end

   def update
    if @post.update(post_params)
      respond_to do |format|
        format.turbo_stream   # update.turbo_stream.erb 
        format.html { redirect_to @post, notice: "Пост обновлён." }
      end
    else
      respond_to do |format|
        format.html { render :edit, status: :unprocessable_entity }
        format.turbo_stream do
          render turbo_stream: turbo_stream.replace("modal", partial: "posts/edit", locals: { post: @post })
        end
      end
    end
  end

  # удаление
def destroy
  @post = current_user.posts.find(params[:id])
  puts "Destroying post: #{@post.id}" # Debug в консоль сервера
  
  if @post.destroy
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to root_path, notice: "Пост удалён." }
    end
  else
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.append("flash", partial: "shared/flash", locals: {
          type: "error",
          message: "Не удалось удалить пост"
        })
      end
      format.html { redirect_to root_path, alert: "Не удалось удалить пост" }
    end
  end
end

  private

  def set_post
    @post = Post.find(params[:id])
  end

  def authorize_user!
    redirect_to posts_path, alert: 'Нет доступа.' unless @post.user == current_user
  end

  def post_params
    params.require(:post).permit(:image, :text)
  end

  def recommended_posts
    query = Post.joins(:user)
                .includes(:user, image_attachment: :blob)
                .order(created_at: :desc)
    
    # Исключаем посты пользователей, на которых уже подписаны
    if user_signed_in? && current_user.following_ids.any?
      query = query.where.not(user_id: current_user.following_ids + [current_user.id])
    end
    
    query.limit(50)
  end
end