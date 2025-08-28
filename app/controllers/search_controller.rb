class SearchController < ApplicationController
  include Rails.application.routes.url_helpers

  before_action :authenticate_user!

  # обработчик JSON формата для поиска пользователей
  def users
    query = params[:q].to_s.strip.downcase

    users = User.where("LOWER(username) LIKE ? OR LOWER(name) LIKE ?", "%#{query}%", "%#{query}%")

    render json: users.map { |user|
      {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar.attached? ? url_for(user.avatar) : nil,
        profile_url: user_path(user)  
      }
    }
  end

  # обработчик JSON формата для поиска постов
  def posts
    query = params[:q].to_s.strip
    # Исправлено: posts.text вместо posts.content
    posts = Post.joins(:user)
               .where("LOWER(posts.text) LIKE ? OR LOWER(users.username) LIKE ?", 
                     "%#{query.downcase}%", "%#{query.downcase}%")
               .limit(10)

    render json: posts.map { |post| 
      {
        id: post.id,
        content: post.text, 
        author_name: post.user.name,
        author_username: post.user.username,
        author_avatar: post.user.avatar.attached? ? url_for(post.user.avatar) : '/default-avatar.png',
        created_at: time_ago_in_words_helper(post.created_at) # Исправлено
      }
    }
  end

  private

  # Метод time_ago_in_words_helper для форматирования времени
  def time_ago_in_words_helper(time)
    return "" unless time
    
    diff = (Time.now - time).to_i
    case diff
    when 0..59
      "только что"
    when 60..3599
      minutes = (diff / 60).to_i
      "#{minutes} #{minutes == 1 ? 'минуту' : (minutes < 5 ? 'минуты' : 'минут')} назад"
    when 3600..86399
      hours = (diff / 3600).to_i
      "#{hours} #{hours == 1 ? 'час' : (hours < 5 ? 'часа' : 'часов')} назад"
    when 86400..604799
      days = (diff / 86400).to_i
      "#{days} #{days == 1 ? 'день' : (days < 5 ? 'дня' : 'дней')} назад"
    else
      time.strftime("%d.%m.%Y")
    end
  end
end