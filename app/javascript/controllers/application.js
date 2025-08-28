import { Application } from "@hotwired/stimulus"

const application = Application.start()

// Configure Stimulus development experience
application.debug = false
window.Stimulus   = application

export { application }

// Обработка якорей при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  processPostAnchor()
})

// Также обрабатываем при Turbo navigation
document.addEventListener('turbo:load', function() {
  processPostAnchor()
})

function processPostAnchor() {
  const hash = window.location.hash
  if (hash && hash.startsWith('#post_')) {
    const postId = hash.replace('#post_', '')
    const postElement = document.getElementById(`post_${postId}`)
    
    if (postElement) {
      // Небольшая задержка для полной загрузки страницы
      setTimeout(() => {
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        postElement.classList.add('highlighted-post')
        
        setTimeout(() => {
          postElement.classList.remove('highlighted-post')
        }, 2000)
      }, 100)
    }
  }
  
}