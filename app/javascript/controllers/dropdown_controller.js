import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu"]

  toggle(event) {
    event.stopPropagation()
    this.menuTarget.classList.toggle("hidden")
  }

  close(event) {
    // Закрываем меню при клике вне элемента
    if (!this.element.contains(event.target)) {
      this.menuTarget.classList.add("hidden")
    }
  }

  // Метод для закрытия меню при клике на кнопку удаления
  closeMenu() {
    this.menuTarget.classList.add("hidden")
  }

  connect() {
    this.closeBound = this.close.bind(this)
    document.addEventListener("click", this.closeBound)
  }

  disconnect() {
    document.removeEventListener("click", this.closeBound)
  }
}