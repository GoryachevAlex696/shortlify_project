import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "content", "preview", "removeBtn"]

  connect() {
    console.log("✅ image-preview controller connected")
    if (this.inputTarget.files.length > 0) {
      this.showPreview(this.inputTarget.files[0])
    }
  }

  inputChanged(event) {
    const file = event.target.files[0]
    if (file) {
      this.showPreview(file)
    }
  }

  showPreview(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      this.previewTarget.innerHTML = `
        <img src="${e.target.result}" alt="Preview" />
        <button type="button" class="remove-image-btn"
                data-action="click->image-preview#clearPreview">
          &times;
        </button>
      `
      this.previewTarget.classList.remove("hidden")
      this.contentTarget.classList.add("hidden")
    }
    reader.readAsDataURL(file)
  }

  clearPreview() {
    this.inputTarget.value = ""
    this.previewTarget.innerHTML = ""
    this.previewTarget.classList.add("hidden")
    this.contentTarget.classList.remove("hidden")
  }

  openFileDialog() {
  this.inputTarget.click()
}
}