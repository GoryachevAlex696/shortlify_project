class RegistrationsController < Devise::RegistrationsController
  before_action :configure_sign_up_params, only: [:create]
  before_action :configure_account_update_params, only: [:update]

  def destroy
    # Дополнительная логика перед удалением
    current_user.posts.destroy_all if current_user.posts.any?
    current_user.avatar.purge if current_user.avatar.attached?
    
    # Стандартное удаление Devise
    super
  end

  protected

  def configure_sign_up_params
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name, :username])
  end

  def configure_account_update_params
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :username])
  end

  def after_sign_out_path_for(resource)
    root_path
  end
end