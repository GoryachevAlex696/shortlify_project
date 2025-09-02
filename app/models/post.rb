class Post < ApplicationRecord
  belongs_to :user, optional: true
  has_one_attached :image

  validates :image, presence: true
  validates :text, presence: true
  
  # SCOPE для получения постов от других пользователей
  scope :from_other_users, ->(user) { where.not(user_id: user.id) }

  # Метод для получения ленты (для текущего пользователя или всех)
  def self.feed_for(user)
    user ? all : where(public: true) # Или ваша логика фильтрации
  end

def image_url
  if image.attached?
    Rails.application.routes.url_helpers.rails_blob_url(image, only_path: true)
  end
end

  # Для поиска постов
  def self.search(query)
    where("title LIKE ? OR body LIKE ?", "%#{query}%", "%#{query}%")
  end
end
