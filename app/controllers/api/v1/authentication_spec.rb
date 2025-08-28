require 'swagger_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  path '/api/v1/auth/login' do

    post('login') do
      tags 'Authentication'
      consumes 'application/json'
      parameter name: :credentials, in: :body, schema: {
        type: :object,
        properties: {
          email: { type: :string },
          password: { type: :string }
        },
        required: ['email', 'password']
      }

      response(200, 'successful') do
        let(:credentials) { { email: 'user@example.com', password: 'password' } }
        run_test!
      end

      response(401, 'unauthorized') do
        let(:credentials) { { email: 'user@example.com', password: 'wrong' } }
        run_test!
      end
    end
  end

  path '/api/v1/auth/register' do

    post('register') do
      tags 'Authentication'
      consumes 'application/json'
      parameter name: :user, in: :body, schema: {
        type: :object,
        properties: {
          email: { type: :string },
          password: { type: :string },
          username: { type: :string },
          name: { type: :string }
        },
        required: ['email', 'password', 'username']
      }

      response(201, 'user created') do
        let(:user) { { 
          email: 'new@example.com', 
          password: 'password123', 
          username: 'newuser',
          name: 'New User'
        } }
        run_test!
      end
    end
  end
end