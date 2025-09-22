FROM node:18-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY package-lock.json* ./

# Устанавливаем зависимости
RUN npm ci

# Копируем весь код фронтенда
COPY . .

# Собираем приложение
RUN npm run build -- --no-lint

EXPOSE 3001

CMD ["npm", "run", "dev"]