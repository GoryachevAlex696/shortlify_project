require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module Shortlify
  class Application < Rails::Application

    config.load_defaults 8.0


    config.autoload_lib(ignore: %w[assets tasks])

    # API
    config.active_storage.service_urls_expire_in = 1.hour

      config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins 'http://localhost:3001' # Next.js dev server
        resource '*',
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          credentials: true
      end
    end
  end  
end
