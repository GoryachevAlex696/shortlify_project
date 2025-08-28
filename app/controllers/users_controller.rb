class UsersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_user, only: [:edit_avatar, :update_avatar, :remove_avatar, :follow, :unfollow, :following, :followers]

  def index
  end

  def show
    @user = User.find(params[:id])
  end

  # --- Модалка для редактирования аватара ---
  def edit_avatar
    render partial: "users/avatar_modal", locals: { user: @user }
  end

  def update_avatar
    @user = current_user
    
    if params[:user].nil? || params[:user][:avatar].nil?
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: turbo_stream.update("modal", partial: "users/avatar_modal", locals: { 
            user: @user, 
            error: "Пожалуйста, выберите файл для загрузки" 
          })
        end
      end
      return
    end

    if @user.update(avatar: params[:user][:avatar])
      respond_to do |format|
        format.turbo_stream # используем update_avatar.turbo_stream.erb
        format.html { redirect_to profile_path, notice: "Аватар обновлен" }
      end
    else  
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: turbo_stream.update("modal", partial: "users/avatar_modal", locals: { 
            user: @user, 
            error: @user.errors.full_messages.join(", ") 
          })
        end
      end
    end
  end

  def remove_avatar
    @user = current_user
    
    # Проверяем, что аватар действительно существует
    if @user.avatar.attached?
      @user.avatar.purge
      
      respond_to do |format|
        format.turbo_stream # Будет использовать remove_avatar.turbo_stream.erb
        format.html { redirect_to profile_path, notice: "Аватар удалён" }
      end
    else
      # Если аватар уже удален или не существует
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: [
            turbo_stream.replace("user_avatar_#{@user.id}", partial: "users/avatar", locals: { user: @user }),
            turbo_stream.remove("editAvatarContainer"),
            turbo_stream.append("flash", partial: "shared/flash", locals: { 
              type: "warning", 
              message: "Аватар уже удален" 
            })
          ]
        end
        format.html { redirect_to profile_path, alert: "Аватар уже удален" }
      end
    end
  end

  def search
    query = params[:q].to_s.strip.downcase
    escaped_query = query.gsub(/([_%])/, '\\\\\1') # Экранирование спецсимволов
    @users = User.where("LOWER(username) LIKE :q OR LOWER(name) LIKE :q", 
                      q: "%#{escaped_query}%").limit(10)

    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.update('search-results-container',
          partial: 'users/search_results',
          locals: { users: @users })
      end
      format.html { render partial: 'users/search_results', locals: { users: @users } }
    end
  end

  def follow
    @user = User.find(params[:id])
    current_user.following << @user
    redirect_to @user
  end

  def unfollow
    @user = User.find(params[:id])
    current_user.following.delete(@user)
    redirect_to @user
  end

  def following
    @user = User.find(params[:id])
    @users = @user.following.paginate(page: params[:page])
    render 'show_follow'
  end

  def followers
    @user = User.find(params[:id])
    @users = @user.followers.paginate(page: params[:page])
    render 'show_follow'
  end

private

  def set_user
    @user = User.find(params[:id])
  end

  def avatar_params
    params.require(:user).permit(:avatar)
  end
end
