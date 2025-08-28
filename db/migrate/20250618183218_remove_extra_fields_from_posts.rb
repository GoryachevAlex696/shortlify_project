class RemoveExtraFieldsFromPosts < ActiveRecord::Migration[8.0]
  def change
    remove_column :posts, :body, :string
    remove_column :posts, :event_date, :date
    remove_column :posts, :event_time, :time
    remove_column :posts, :location, :string
    remove_column :posts, :author_name, :string
  end
end
