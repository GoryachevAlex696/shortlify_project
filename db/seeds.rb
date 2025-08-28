# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end
# Убедитесь, что есть пользователь
# Убедимся, что есть пользователь
# Проверяем и создаем пользователя
# Убедимся, что есть пользователь
user = User.first || User.create!(
  email: 'admin@example.com',
  password: 'password',
  username: 'admin'
)

# Путь к тестовому изображению (положите файл в указанную папку)
image_path = Rails.root.join('app', 'assets', 'images', 'linkin_park.jpg')

# Создаем пост с ВСЕМИ обязательными полями
post = Post.new(
  title: "Концерт SYSTEM OF A DOWN",
  body: "Город Open! Орловчане",
  #event_date: Date.today + 7.days, # Дата через неделю
  #event_time: Time.now.change(hour: 19, min: 0), # 19:00
  location: "PARK",
  author_name: "Редакция",
  user: user
)

# Прикрепляем изображение
if File.exist?(image_path)
  post.image.attach(
    io: File.open(image_path),
    filename: 'linkin_park.jpg',
    content_type: 'image/jpg'
  )
else
  puts "Файл изображения не найден по пути: #{image_path}"
  puts "Создаю пост без изображения (отключите валидацию, если нужно)"
end

post.save!
