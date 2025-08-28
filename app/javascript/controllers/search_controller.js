import { Controller } from "@hotwired/stimulus"
import debounce from "lodash.debounce"

export default class extends Controller {
  static targets = [
    "dropdown",
    "usersTab", 
    "postsTab",
    "usersInput", 
    "postsInput",
    "usersResults",
    "postsResults",
    "meta"
  ]

  static values = {
    url: String,
    postsUrl: String
  }

  connect() {
    // Создаем debounce версии методов с разными именами
    this.debouncedPerformUserSearch = debounce(this._performUserSearch.bind(this), 300)
    this.debouncedPerformPostSearch = debounce(this._performPostSearch.bind(this), 300)
    console.log("Контроллер подключен!")
  }

  // Показ/скрытие выпадающего меню
  toggleDropdown() {
    this.dropdownTarget.classList.toggle("active")
    // При открытии фокусируем на активном поле ввода
    if (this.dropdownTarget.classList.contains("active")) {
      const activeTab = this.element.querySelector(".search-tab.active").dataset.tab
      if (activeTab === "users") {
        setTimeout(() => this.usersInputTarget.focus(), 100)
      } else {
        setTimeout(() => this.postsInputTarget.focus(), 100)
      }
    }
  }

  closeDropdown(event) {
    if (event) event.preventDefault()
    this.dropdownTarget.classList.remove("active")
    this.element.classList.remove("active")
    this.stopClickOutsideListener()
  }

  // Переключение вкладок
  switchTab(event) {
    const tab = event.currentTarget.dataset.tab
    
    this.usersTabTarget.classList.add("hidden")
    this.postsTabTarget.classList.add("hidden")

    // Переключаем активную кнопку
    this.element.querySelectorAll(".search-tab").forEach(tabEl => {
      tabEl.classList.toggle("active", tabEl.dataset.tab === tab)
    })

    // Показываем выбранную вкладку
    if (tab === "users") {
      this.usersTabTarget.classList.remove("hidden")
      setTimeout(() => this.usersInputTarget.focus(), 100)
    } else {
      this.postsTabTarget.classList.remove("hidden")
      setTimeout(() => this.postsInputTarget.focus(), 100)
    }
  }

  // Поиск пользователей
  performUserSearch() {
    this.debouncedPerformUserSearch()
  }

  _performUserSearch() {
    if (this.usersTabTarget.classList.contains("hidden")) return
    const query = this.usersInputTarget.value.trim()
    
    if (query.length < 2) {
      this.showUserPlaceholder()
      return
    }

    fetch(`${this.urlValue}?q=${encodeURIComponent(query)}`)
      .then(response => {
        if (!response.ok) throw new Error("Search failed")
        return response.json()
      })
      .then(data => this.showUserResults(data))
      .catch(error => {
        console.error("Search error:", error)
        this.showUserError()
      })
  }

  showUserResults(users) {
    if (!users || users.length === 0) {
      this.usersResultsTarget.innerHTML = `
        <div class="search-placeholder">
          <i class="fas fa-user-times"></i>
          <p>Пользователи не найдены</p>
        </div>
      `
      this.metaTarget.textContent = ""
      return
    }

    this.usersResultsTarget.innerHTML = users.map(user => `
      <a href="${user.profile_url}" data-turbo="false" class="search-result" style="text-decoration: none; color: inherit;">
        <img src="${user.avatar_url || '/default-avatar.png'}" class="avatar" alt="${user.name}">
        <div class="user-info">
          <strong>${user.name}</strong><br>
          <small>@${user.username}</small>
        </div>
      </a>
    `).join("")
    
    this.metaTarget.textContent = `Найдено: ${users.length}`
  }

  showUserPlaceholder() {
    this.usersResultsTarget.innerHTML = `
      <div class="search-placeholder">
        <i class="fas fa-search"></i>
        <p>Начните вводить имя пользователя</p>
      </div>
    `
    this.metaTarget.textContent = ""
  }

  showUserError() {
    this.usersResultsTarget.innerHTML = `
      <div class="search-placeholder">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка поиска</p>
      </div>
    `
    this.metaTarget.textContent = ""
  }

  // Очистка поиска пользователей
  clearUserSearch() {
    this.usersInputTarget.value = ""
    this.showUserPlaceholder()
  }

  // Поиск постов
  performPostSearch() {
    this.debouncedPerformPostSearch()
  }

  _performPostSearch() {
    if (this.postsTabTarget.classList.contains("hidden")) return
    const query = this.postsInputTarget.value.trim()
    
    if (query.length < 2) {
      this.showPostPlaceholder()
      return
    }

    this.showPostLoading()

    fetch(`${this.postsUrlValue}.json?q=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON')
      }
      return response.json()
    })
    .then(data => this.showPostResults(data))
    .catch(error => {
      console.error("Post search error:", error)
      this.showPostError()
    })
  }

  showPostLoading() {
    this.postsResultsTarget.innerHTML = `
      <div class="posts-placeholder">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Поиск постов...</p>
      </div>
    `
  }

  // Отображение результатов постов
  showPostResults(posts) {
    if (!posts || posts.length === 0) {
      this.postsResultsTarget.innerHTML = `
        <div class="posts-placeholder">
          <i class="fas fa-search"></i>
          <p>Посты не найдены</p>
          <small>Попробуйте изменить запрос</small>
        </div>
      `
      return
    }

    this.postsResultsTarget.innerHTML = posts.map(post => `
      <div class="post-result" data-action="click->search#openPost" data-post-id="${post.id}">
        <div class="post-header">
          <img src="${post.author_avatar || '/default-avatar.png'}" 
               class="author-avatar" 
               alt="${post.author_name}">
          <div class="post-meta">
            <span class="author-name">${post.author_name}</span>
            <span class="author-username">@${post.author_username}</span>
            <span class="post-date">· ${post.created_at}</span>
          </div>
        </div>
        <p class="post-text">${this.highlightText(post.content, this.postsInputTarget.value)}</p> 
      </div>
    `).join('')
  }

  // Подсветка текста
  highlightText(text, query) {
    if (!query || !text) return text || ''
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    return text.replace(regex, '<span class="highlight">$1</span>')
  }

  // Плейсхолдеры для постов
  showPostPlaceholder() {
    this.postsResultsTarget.innerHTML = `
      <div class="posts-placeholder">
        <i class="fas fa-search"></i>
        <p>Начните вводить текст поста</p>
        <small>Минимум 2 символа</small>
      </div>
    `
  }

  showPostError() {
    this.postsResultsTarget.innerHTML = `
      <div class="posts-placeholder">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка поиска</p>
        <small>Попробуйте позже</small>
      </div>
    `
  }

  // Очистка поиска постов
  clearPostSearch() {
    this.postsInputTarget.value = ""
    this.showPostPlaceholder()
  }

  // Открытие поста
  openPost(event) {
    const postId = event.currentTarget.dataset.postId
    
    // Закрываем поисковое меню
    this.closeDropdown()
    
    // Прокручиваем к нужному посту
    const postElement = document.getElementById(`post_${postId}`)
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      
      // Добавляем подсветку
      postElement.classList.add('highlighted-post')
      setTimeout(() => {
        postElement.classList.remove('highlighted-post')
      }, 2000)
    } else {
      // Если пост не найден на текущей странице, переходим на страницу поста
      window.location.href = `/posts#post_${postId}`
    }
  }

  // Закрытие при клике вне меню
  startClickOutsideListener() {
    this.handleOutsideClick = this.handleOutsideClick.bind(this)
    document.addEventListener("click", this.handleOutsideClick)
  }

  stopClickOutsideListener() {
    document.removeEventListener("click", this.handleOutsideClick)
  }

  handleOutsideClick(event) {
    const clickedInside = this.element.contains(event.target)
    if (!clickedInside) {
      this.closeDropdown()
    }
  }

  // Закрытие по Escape
  handleKeydown(event) {
    if (event.key === "Escape") {
      this.closeDropdown()
    }
  }
}