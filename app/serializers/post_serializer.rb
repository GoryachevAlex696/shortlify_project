class PostSerializer < ActiveModel::Serializer
  attributes :id, :text, :created_at, :image_url
  
  belongs_to :user, serializer: UserSerializer
  
  def image_url
    object.image_url # используем метод из модели Post
  end
end