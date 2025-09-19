Rails.application.routes.draw do
  get "follows/create"
  get "follows/destroy"

  devise_for :users, controllers: {
  registrations: 'registrations'
}
  
  resources :posts

  resources :users, only: [:show] do
  member do
    post 'follow', to: 'follows#create'
    delete 'unfollow', to: 'follows#destroy'
  end
end

  get '/profile/:id', to: 'users#show', as: :profile
  
  resources :users do
    member do
      get :edit_avatar
      patch :update_avatar
      delete :remove_avatar
      get :edit
    end
  end

  get "/search/users", to: "search#users", as: :search_users

  get 'search/posts', to: 'search#posts', as: :search_posts

  # Авторизованных — на ленту, гостей — на приветствие
   authenticated :user do
     root 'posts#index', as: :authenticated_root
   end
   root to: redirect('users/sign_in')

   # для автоматизации подтверждения почты в development
   if Rails.env.development?
      mount LetterOpenerWeb::Engine, at: "/letter_opener"
   end
  # ==================== API ROUTES ====================
namespace :api, defaults: { format: :json } do
  namespace :v1 do

    # Регистрация
    post 'signup', to: 'registrations#create'
    # Аутентификация 
    post 'login', to: 'authentication#login'
    delete 'logout', to: 'authentication#logout'

    # Удаление пользователя 
    delete 'users/:id', to: 'users#destroy'

    # Ресурсы 
    resources :posts, only: [:index, :show, :create, :update, :destroy]

    resources :users, only: [:index, :show, :update] do  # Добавили :index
      member do
        put :avatar, to: 'users#update_avatar'
        delete :avatar, to: 'users#remove_avatar'        # Добавили удаление аватара
        get :posts
        get :followers
        get :following
        post :follow
        delete :unfollow, to: 'users#unfollow'           # Исправили на унифицированный endpoint
      end
      collection do
        get :search, to: 'users#search'                  # Добавили поиск пользователей
      end
    end

    # Поиск 
    get 'search/users', to: 'search#users'
    get 'search/posts', to: 'search#posts'

    # Добавляем ленту 
    get 'feed', to: 'posts#feed'
  end
end
end
