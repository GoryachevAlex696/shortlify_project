import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"

window.Stimulus = application
eagerLoadControllersFrom("controllers", application)