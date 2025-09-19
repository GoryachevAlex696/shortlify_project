class Api::V1::UsersController < Api::V1::BaseController
  before_action :set_user, only: [:show, :update_avatar, :remove_avatar, :follow, :unfollow, :following, :followers, :posts]

  # GET /api/v1/users
  def index
    users = User.all
    render json: users, each_serializer: UserSerializer
  end

  # GET /api/v1/users/:id
  def show
    render json: UserSerializer.new(@user, scope: current_user).as_json
  end

  # PUT /api/v1/users/:id/avatar
  def update_avatar
    if params[:avatar].nil?
      render json: { error: "Avatar file is required" }, status: :bad_request
      return
    end

    if @user.update(avatar: params[:avatar])
      render json: { 
        message: "Аватар успешно обновлен",
        user: UserSerializer.new(@user, current_user: current_user).as_json 
      }
    else
      render json: { error: @user.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/users/:id/avatar
  def remove_avatar
    if @user.avatar.attached?
      @user.avatar.purge
      render json: { 
        message: "Avatar removed successfully",
        user: UserSerializer.new(@user, current_user: current_user).as_json
      }
    else
      render json: { error: "Avatar already removed" }, status: :not_found
    end
  end

  # GET /api/v1/users/search?q=query
  def search
    query = params[:q].to_s.strip.downcase
    escaped_query = query.gsub(/([_%])/, '\\\\\1')
    
    users = User.where("LOWER(username) LIKE :q OR LOWER(name) LIKE :q", q: "%#{escaped_query}%").limit(10)
    render json: users, each_serializer: UserSerializer
  end

  # POST /api/v1/users/:id/follow
  def follow
    if current_user.follow(@user)
      render json: UserSerializer.new(@user, scope: current_user).as_json
    else
      render json: { error: "Unable to follow user" }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/users/:id/follow  
  def unfollow
    if current_user.unfollow(@user)
      render json: UserSerializer.new(@user, scope: current_user).as_json
    else
      render json: { error: "Unable to unfollow user" }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/users/:id/following
  def following
    users = @user.following.limit(20)
    render json: users, each_serializer: UserSerializer, current_user: current_user
  end

  # GET /api/v1/users/:id/followers
  def followers
    users = @user.followers.limit(20)
    render json: users, each_serializer: UserSerializer, current_user: current_user
  end

  # GET /api/v1/users/:id/posts
  def posts
    user_posts = @user.posts.order(created_at: :desc)
    render json: user_posts, each_serializer: PostSerializer
  end

  # DELETE /api/v1/users/:id
  def destroy
    if @user == current_user
      current_user.posts.destroy_all if current_user.posts.any?
      current_user.avatar.purge if current_user.avatar.attached?

      if current_user.destroy
        render json: { status: :success, message: 'Аккаунт успешно удален' }, status: :ok
      else
        render json: { status: :error, errors: current_user.errors.full_messages }, status: :unprocessable_entity
      end
    else
      render json: { status: :error, error: 'Можно удалить только свой аккаунт' }, status: :forbidden
    end
  end

  private

  def set_user
    @user = User.find(params[:id])
  end
end