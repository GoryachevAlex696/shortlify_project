Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "http://localhost:3001" # фронтенд

    resource "*",
      headers: :any,
      expose: ["Content-Disposition", "ETag"],
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end
