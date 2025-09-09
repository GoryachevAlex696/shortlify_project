class Api::V1::RegistrationsController < Api::V1::BaseController
  skip_before_action :authenticate_request, only: [:create]
  
  # POST /api/v1/signup
  def create
    user = User.new(user_params)
    
    if user.save
      if user.confirmed?
        # когда пользователь уже подтвержден 
        token = JWT.encode({ user_id: user.id }, Rails.application.secret_key_base, 'HS256')
        render json: { status: :success, user: UserSerializer.new(user), token: token }, status: :created
      else
        # пользователь создан, но не подтвержден
        render json: {
          status: :success,
          message: "Регистрация завершена. Проверьте email для подтверждения."
        }, status: :created
      end
    else
      render json: { status: :error, errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.require(:user).permit(:email, :password, :password_confirmation, :username, :name)
  end
end