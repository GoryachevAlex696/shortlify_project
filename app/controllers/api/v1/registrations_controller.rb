class Api::V1::RegistrationsController < Api::V1::BaseController
  skip_before_action :authenticate_request, only: [:create]
  
  # POST /api/v1/signup
  def create
    user = User.new(user_params)
    
    if user.save
      # Генерируем JWT токен
      payload = { user_id: user.id }
      token = JWT.encode(payload, Rails.application.secret_key_base, 'HS256')
        
      render json: {
        status: :success,
        message: 'Регистрация успешно завершена',
        user: UserSerializer.new(user).as_json,
        token: token
      }, status: :created
    else
      render json: {
        status: :error,
        errors: user.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.require(:user).permit(:email, :password, :password_confirmation, :username, :name)
  end
end