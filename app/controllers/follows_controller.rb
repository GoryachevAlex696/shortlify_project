class FollowsController < ApplicationController
  before_action :authenticate_user!

  def create
    user = User.find(params[:id])
    current_user.following << user unless current_user == user
    redirect_to user_path(user)
  end

  def destroy
    user = User.find(params[:id])
    follow = current_user.following_relationships.find_by(followed_id: user.id)
    follow.destroy if follow
    redirect_to user_path(user)
  end
end