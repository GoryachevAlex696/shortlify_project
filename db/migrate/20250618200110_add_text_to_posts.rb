class AddTextToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :text, :text
  end
end
