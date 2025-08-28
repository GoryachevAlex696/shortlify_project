class Api::V1::BaseController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :authenticate_request

  private

  def authenticate_request
    header = request.headers['Authorization']
    
    if header
      token = header.split(' ').last
      
      begin
        decoded = JWT.decode(token, Rails.application.secret_key_base, true, { algorithm: 'HS256' })
        @current_user = User.find(decoded[0]['user_id'])
      rescue JWT::DecodeError, ActiveRecord::RecordNotFound
        render json: { error: 'Unauthorized' }, status: :unauthorized
      end
    else
      render json: { error: 'Authorization header missing' }, status: :unauthorized
    end
  end

  def current_user
    @current_user
  end
end