source "https://rubygems.org"

gem "rails", "~> 8.0.2"
gem "propshaft"
gem "mysql2", "~> 0.5"
gem "puma", ">= 5.0"
gem "importmap-rails"
gem "turbo-rails"
gem "stimulus-rails"
gem "jbuilder"

# Важно: bcrypt нужен и для devise, и для jwt
gem "bcrypt", "~> 3.1.7"

gem "tzinfo-data", platforms: %i[ windows jruby ]

gem "solid_cache"
gem "solid_queue"
gem "solid_cable"

gem "bootsnap", require: false
gem "kamal", require: false
gem "thruster", require: false
gem "image_processing", "~> 1.2"

# Аутентификация
gem "devise", "~> 4.9"
gem "jwt"

# Загрузка и работа с изображениями
gem "mini_magick", "~> 5.3"
gem "ruby-vips", "~> 2.1"
gem "active_storage_validations"

# Поиск
gem "searchkick"

# HTTP-запросы
gem "faraday"

# Сериализация
gem "active_model_serializers"

# Документация API (Swagger)
gem "rswag"

# CORS
gem "rack-cors"

group :development, :test do
  gem "brakeman", require: false
  gem "rubocop", require: false
  gem "rubocop-rails", require: false
  gem "rubocop-performance", require: false
end

group :development do
  gem "web-console"
  gem "letter_opener", "~> 1.8"
  gem "letter_opener_web", "~> 2.0"
end

group :test do
  gem "capybara"
  gem "selenium-webdriver"
end