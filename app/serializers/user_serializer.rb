class UserSerializer < ActiveModel::Serializer
  attributes :id, :email, :username, :name, :avatar_url, :followers_count, :following_count

end