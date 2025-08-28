# Pin npm packages by running ./bin/importmap

# pin "application"
# pin "@hotwired/stimulus", to: "@hotwired--stimulus.js" # @3.2.2
# pin "@hotwired/stimulus", to: "vendor/stimulus.min.js"
# pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"

# Pin npm packages by running ./bin/importmap
pin "application"
pin "@hotwired/stimulus", to: "https://ga.jspm.io/npm:@hotwired/stimulus@3.2.2/dist/stimulus.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin "lodash.debounce", to: "https://ga.jspm.io/npm:lodash.debounce@4.0.8/index.js"
pin "@hotwired/turbo-rails", to: "turbo.min.js", preload: true
pin_all_from "app/javascript/controllers", under: "controllers"