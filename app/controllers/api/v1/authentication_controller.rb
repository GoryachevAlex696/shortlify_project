class Api::V1::AuthenticationController < Api::V1::BaseController
  skip_before_action :authenticate_request, only: [:login, :register]

  def login
    # Получаем параметры из вложенного user
    user_params = params[:user] || {}
    identifier = user_params[:email] || user_params[:username]
    password = user_params[:password]
    
    # Ищем пользователя по email или username
    user = User.where('email = :id OR username = :id', id: identifier).first
    
    if user && user.valid_password?(password)
      token = generate_token(user)
      render json: { 
        token: token, 
        user: UserSerializer.new(user).as_json 
      }
    else
      render json: { error: 'Неправильные учетные данные' }, status: :unauthorized
    end
  end

  def register
    user = User.new(user_params)
    
    if user.save
      token = jwt_encode(user_id: user.id)
      render json: { 
        token: token,
        user: UserSerializer.new(user).as_json 
      }, status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def logout
    # Можно добавить blacklist токенов
    render json: { message: 'Выход из системы выполнен успешно' }
  end

  private

  def generate_token(user)
    payload = { 
      user_id: user.id, 
      exp: 24.hours.from_now.to_i 
    }
    JWT.encode(payload, Rails.application.secret_key_base, 'HS256')
  end

  def user_params
    params.permit(:email, :password, :username, :name, :avatar)
  end

  def jwt_encode(payload)
    JWT.encode(payload, Rails.application.secrets.secret_key_base, 'HS256')
  end
end