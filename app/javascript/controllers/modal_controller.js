import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal"]

  connect() {
    console.log("✅ Modal controller connected")

    // Скрываем все модалки при подключении
    this.modalTargets.forEach(modal => modal.classList.add("hidden"))

    // Привязываем обработчик клавиши Escape
    this._handleEscape = this.handleEscape.bind(this)
    document.addEventListener("keydown", this._handleEscape)
  }

  disconnect() {
    document.removeEventListener("keydown", this._handleEscape)
  }

  open(event) {
    const id = event.currentTarget.getAttribute("data-target-id")
    const modal = document.getElementById(id)

    if (modal) {
      modal.classList.remove("hidden")

      // небольшой таймаут для срабатывания transition
      setTimeout(() => {
        modal.classList.add("show")
        modal.setAttribute("aria-hidden", "false")
      }, 10)
    }
  }

  close(event) {
    // Закрываем ближайшую модалку
    const modal = event.currentTarget.closest('.modal');
    console.log("Found modal:", modal);
    
    if (modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");

      setTimeout(() => {
        modal.classList.add("hidden");
        console.log("Modal hidden successfully");
      }, 300);
    }
    
    event.stopPropagation();
  }

  handleEscape(event) {
    if (event.key === "Escape") {
      this.modalTargets.forEach(modal => {
        modal.classList.remove("show")
        modal.setAttribute("aria-hidden", "true")

        setTimeout(() => modal.classList.add("hidden"), 300)
      })
    }
  }

  clickOutside(event) {
    // Закрытие при клике по оверлею
    if (event.target.classList.contains("modal")) {
      event.target.classList.remove("show")
      event.target.setAttribute("aria-hidden", "true")

      setTimeout(() => event.target.classList.add("hidden"), 300)
    }
  }

  stopPropagation(event){
    event.stopPropagation()
  }

  openPost(event) {
  const postId = event.currentTarget.dataset.postId

  fetch(`/posts/${postId}`, {
    headers: { Accept: "text/vnd.turbo-stream.html" }
  })
}

closeAndReload() {
  this.close();
  setTimeout(() => {
    window.location.reload();
  }, 300);
}

}