class AddDetailsToPosts < ActiveRecord::Migration[8.0]
  def change
    add_column :posts, :event_date, :date
    add_column :posts, :event_time, :time
    add_column :posts, :location, :string
    add_column :posts, :author_name, :string
  end
end
