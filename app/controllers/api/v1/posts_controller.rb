class Api::V1::PostsController < Api::V1::BaseController
  before_action :set_post, only: [:show, :update, :destroy]

  def index
    posts = Post.includes(:user, image_attachment: :blob).order(created_at: :desc)
    render json: posts, each_serializer: PostSerializer
  end

  def show
    render json: @post.as_json(
      only: [:id, :title, :content, :created_at, :updated_at],
      include: { 
        user: { 
          only: [:id, :username] 
        }
      },
      methods: [:image_url] # Добавляем метод для URL изображения
    )
  end

  def create
    post = current_user.posts.build(post_params)
    if post.save
      render json: post, status: :created
    else
      render json: { errors: post.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @post.user == current_user && @post.update(post_params)
      render json: @post
    else
      render json: { error: "Нет доступа или ошибка обновления" }, status: :forbidden
    end
  end

  # GET /api/v1/feed
  def feed
    # логика для получения ленты
    posts = Post.all.order(created_at: :desc) # все посты по убыванию даты
        
    render json: posts
  end

  def destroy
    if @post.user == current_user
      @post.destroy
      render json: { message: "Пост удалён" }
    else
      render json: { error: "Нет доступа" }, status: :forbidden
    end
  end

  private

  def set_post
    @post = Post.find(params[:id])
  end

  def post_params
    params.permit(:image, :text)
  end
end