class AddUserIdToPosts < ActiveRecord::Migration[6.1]
  def change
    # Проверяем, существует ли столбец, прежде чем добавлять
    unless column_exists?(:posts, :user_id)
      add_reference :posts, :user, null: true, foreign_key: true
    end
  end
end