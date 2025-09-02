# Shortlify

Rails 8.0 приложение с MySQL, готовое к запуску через Docker Compose.

---

## Быстрый старт

1. Клонировать репозиторий и перейти в папку проекта:
```bash
git clone git clone https://github.com/GoryachevAlex696/shortlify_project.git
cd shortlify_project
```

2. Собрать и запустить контейнеры:
```bash
docker compose up --build
```

3. Приложение доступно на:
```
http://localhost:3000
```

---

## Работа с контейнерами

- Остановить контейнеры:
```bash
docker compose down
```

- Открыть bash в контейнере Rails:
```bash
docker compose exec app bash
```

- Rails консоль:
```bash
docker compose exec app ./bin/rails c
```

---

## Особенности

- Код проекта смонтирован через volume, изменения вступают в силу без пересборки образа.  
- MySQL хранит данные в volume `db_data` — данные сохраняются при пересборке.  
- Bundler кешируется в volume `bundle_cache`.  
- Rails запускается с пользователем `app`.  
- Образ можно загрузить на Docker Hub:
```bash
docker tag shortlify_app goryachevalex969/shortlify:v1.0
docker push goryachevalex969/shortlify:v1.0
```

