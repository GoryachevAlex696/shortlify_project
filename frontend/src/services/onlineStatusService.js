// Сервис для отслеживания онлайн статуса пользователей
class OnlineStatusService {
  constructor() {
    this.onlineUsers = new Map();
    this.heartbeatIntervals = new Map();
    this.lastSeenMap = new Map(); // Храним время последней активности
  }

  // Пользователь онлайн (при авторизации)
  userLoggedIn(userId, userData = {}) {
    console.log(`User ${userId} logged in`);
    
    this.onlineUsers.set(userId, {
      ...userData,
      userId: userId,
      lastSeen: new Date(),
      isOnline: true
    });
    
    this.lastSeenMap.set(userId, new Date());
    
    // Очищаем предыдущий интервал если есть
    if (this.heartbeatIntervals.has(userId)) {
      clearInterval(this.heartbeatIntervals.get(userId));
    }
    
    // Устанавливаем heartbeat
    const interval = setInterval(() => {
      this.updateLastSeen(userId);
    }, 30000); // Обновляем каждые 30 секунд
    
    this.heartbeatIntervals.set(userId, interval);
  }

  // Пользователь вышел из системы
  userLoggedOut(userId) {
    console.log(`User ${userId} logged out`);
    this.setUserOffline(userId);
  }

  // Пользователь offline
  setUserOffline(userId) {
    if (this.onlineUsers.has(userId)) {
      const userData = this.onlineUsers.get(userId);
      this.onlineUsers.set(userId, {
        ...userData,
        isOnline: false,
        lastSeen: new Date()
      });
      
      this.lastSeenMap.set(userId, new Date());
      
      // Очищаем интервал
      if (this.heartbeatIntervals.has(userId)) {
        clearInterval(this.heartbeatIntervals.get(userId));
        this.heartbeatIntervals.delete(userId);
      }
    }
  }

  // Обновляем время последней активности
  updateLastSeen(userId) {
    if (this.onlineUsers.has(userId)) {
      const userData = this.onlineUsers.get(userId);
      const newLastSeen = new Date();
      
      this.onlineUsers.set(userId, {
        ...userData,
        lastSeen: newLastSeen
      });
      
      this.lastSeenMap.set(userId, newLastSeen);
    }
  }

  // Проверяем онлайн ли пользователь (последняя активность не более 2 минут назад)
  isUserOnline(userId) {
    if (!this.onlineUsers.has(userId)) return false;
    
    const userData = this.onlineUsers.get(userId);
    if (!userData.isOnline) return false;
    
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return userData.lastSeen > twoMinutesAgo;
  }

  // Получаем время последней активности
  getLastSeen(userId) {
    return this.lastSeenMap.get(userId) || null;
  }

  // Получаем всех онлайн пользователей
  getOnlineUsers() {
    const online = [];
    for (let [userId, userData] of this.onlineUsers.entries()) {
      if (this.isUserOnline(userId)) {
        online.push(userId);
      }
    }
    return online;
  }

  // Получаем данные пользователя
  getUserStatus(userId) {
    return {
      isOnline: this.isUserOnline(userId),
      lastSeen: this.getLastSeen(userId)
    };
  }
}

// Создаем глобальный экземпляр сервиса
const onlineStatusService = new OnlineStatusService();

export default onlineStatusService;