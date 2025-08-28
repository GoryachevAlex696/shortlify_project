class AddSearchIndexesToUsers < ActiveRecord::Migration[6.1]
  def change
    # Для MySQL используем обычные индексы
    add_index :users, :username
    add_index :users, :name
    
    # Для регистронезависимого поиска в MySQL
    execute <<-SQL
      ALTER TABLE users 
      MODIFY username VARCHAR(255) COLLATE utf8mb4_general_ci,
      MODIFY name VARCHAR(255) COLLATE utf8mb4_general_ci
    SQL
  end
end