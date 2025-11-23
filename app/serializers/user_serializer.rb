class UserSerializer < ActiveModel::Serializer
  attributes :id, :email, :username, :name, :avatar_url, :followers_count, :following_count, :is_following
  def followers_count
    object.followers_count || object.followers.size
  end

  def following_count
    object.following_count || object.following.size
  end

  def is_following
    return false unless scope # scope — это current_user
    scope.following.exists?(object.id)
  end

  def avatar_url
    return unless object.avatar.attached?

    Rails.application.routes.url_helpers.rails_blob_url(
      object.avatar,
      host: "http://localhost:3000"
    )
  end


end