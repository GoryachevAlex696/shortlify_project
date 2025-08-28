class User < ApplicationRecord
devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  has_many :posts, dependent: :destroy

# Пользователи, которые подписались на текущего пользователя
  has_many :follower_relationships,
           foreign_key: :followed_id,
           class_name: 'Follow',
           dependent: :destroy

  has_many :followers,
           through: :follower_relationships,
           source: :follower

  # Пользователи, на которых подписан текущий пользователь
  has_many :following_relationships,
           foreign_key: :follower_id,
           class_name: 'Follow',
           dependent: :destroy

  has_many :following,
           through: :following_relationships,
           source: :followed

  # Методы

  def follow(other_user)
    following << other_user unless self == other_user || following?(other_user)
  end

  def unfollow(other_user)
  following_relationships.find_by(followed_id: other_user.id)&.destroy
  end

  def following?(other_user)
    following.include?(other_user)
  end

  def followers_count
    followers.count
  end

  def following_count
    following.count
  end

  validates :name, presence: true
  validates :username, presence: true, uniqueness: { case_sensitive: false }

  validates :avatar,
          content_type: { 
            in: %w[image/jpeg image/png],  
            message: 'должен быть JPEG или PNG' 
          },
          size: { 
            less_than: 5.megabytes, 
            message: 'должен быть меньше 5 MB' 
          }

  def search_data
    {
      username: username,
      name: name,
      created_at: created_at
    }
  end

  attr_writer :login

  def self.find_for_database_authentication(warden_conditions)
    conditions = warden_conditions.dup
    if login = conditions.delete(:login)
      where(conditions).where(["lower(username) = :value OR lower(email) = :value", 
            { value: login.downcase }]).first
    else
      where(conditions).first
    end
  end

  def avatar_url
    if avatar.attached?
      Rails.application.routes.url_helpers.rails_blob_url(avatar, only_path: true)
    end
  end

  def login
    @login || username || email
  end

end
