require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module Shortlify
  class Application < Rails::Application

    config.load_defaults 8.0


    config.autoload_lib(ignore: %w[assets tasks])

    # API
    config.active_storage.service_urls_expire_in = 1.hour

  end
end
