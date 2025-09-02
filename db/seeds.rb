# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end
# Создаём админа, если его ещё нет
admin = User.find_or_initialize_by(email: "admin@example.com")

if admin.new_record?
  admin.name = "Admin"
  admin.username = "admin"
  admin.password = "password"
  admin.password_confirmation = "password"
  admin.skip_confirmation!   
  admin.save!
  puts "Администратор создан: #{admin.email} / #{admin.password}"
else
  puts "Администратор уже существует: #{admin.email}"
end


