class SetNotNullUserIdOnPosts < ActiveRecord::Migration[6.1]
  def up
    # Находим конкретного пользователя
    user = User.find_by(id: 12)
    
    if user.nil?
      raise ActiveRecord::IrreversibleMigration, 
            "User with id=12 not found. Please create this user first."
    end
    
    # Обновляем все посты без пользователя
    Post.where(user_id: nil).update_all(user_id: 12)
    
    # Устанавливаем NOT NULL constraint
    change_column_null :posts, :user_id, false
  end

  def down
    # Откат - разрешаем NULL значения
    change_column_null :posts, :user_id, true
  end
end