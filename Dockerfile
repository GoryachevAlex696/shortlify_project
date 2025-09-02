# Базовый образ - основа для сборки
ARG RUBY_VERSION=3.2.3
FROM ruby:$RUBY_VERSION AS base

# Установим временную зону
ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /rails

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources

# Устанавливаем зависимости - это часть "сборки самостоятельно"
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
        libvips \
        default-libmysqlclient-dev \
        pkg-config && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives

# Устанавливаем переменные окружения
ENV RAILS_ENV=production \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT=development:test

# Копируем и устанавливаем зависимости приложения
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

# Копируем код приложения
COPY . .

# Компиляция
RUN bundle exec bootsnap precompile app/ lib/
RUN SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile

# Создаём пользователя
RUN groupadd --system --gid 1000 app && \
    useradd app --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R app:app db log storage tmp

USER app

EXPOSE 3000
CMD ["rails", "server", "-b", "0.0.0.0"]