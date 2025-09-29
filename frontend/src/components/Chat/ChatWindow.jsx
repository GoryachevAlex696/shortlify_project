import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Edit3,
  Trash2,
  Check,
  X,
  UserX,
  Trash,
} from "lucide-react";

const DefaultAvatar = ({ className = "w-8 h-8", title = "Аватар пользователя" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    role="img"
    title={title}
  >
    <rect width="24" height="24" rx="12" fill="#E5E7EB" />
    <path
      d="M12 12.5c1.933 0 3.5-1.567 3.5-3.5S13.933 5.5 12 5.5 8.5 7.067 8.5 9s1.567 3.5 3.5 3.5zM5.5 18.5c0-2.485 2.97-4.5 6.5-4.5s6.5 2.015 6.5 4.5"
      stroke="#9CA3AF"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChatWindow = ({ currentUser, targetUser, unreadCount = 0 }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [showDeleteMenu, setShowDeleteMenu] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageMenuRef = useRef(null);
  const headerMenuRef = useRef(null);

  // Карта ошибок загрузки аватарок: { [userId]: true } -> ошибка (показывать DefaultAvatar)
  const [avatarErrorMap, setAvatarErrorMap] = useState({});

  // Утилита: нормализация id в строку
  const toId = (v) => (v === undefined || v === null ? v : String(v));

  // Помощник: установка флага ошибки аватарки
  const setAvatarError = (userId, isError) => {
    setAvatarErrorMap((prev) => {
      const key = String(userId);
      if (isError) {
        if (prev[key]) return prev;
        return { ...prev, [key]: true };
      } else {
        if (!prev[key]) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
    });
  };

  // Возвращает URL аватарки
  const getAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith("http")) return avatarUrl;
    return `http://localhost:3000${avatarUrl}`;
  };

  // Функция рендера аватарки — безопасно показывает <img> или DefaultAvatar
  const RenderAvatar = ({ user, sizeClass = "w-8 h-8", imgClass = "w-full h-full object-cover" }) => {
    const uid = user?.id ? String(user.id) : undefined;
    const avatarUrl = user?.avatar_url ? getAvatarUrl(user.avatar_url) : null;
    const hasError = uid ? !!avatarErrorMap[uid] : false;

    // Если нет URL аватарки или ранее была ошибка -> показываем аватар по умолчанию
    if (!avatarUrl || hasError) {
      return (
        <div className={`w-full h-full flex items-center justify-center`}>
          <DefaultAvatar className={sizeClass} title={user?.username || "Пользователь"} />
        </div>
      );
    }

    return (
      <img
        src={avatarUrl}
        alt={user?.username || "аватар"}
        className={imgClass}
        loading="lazy"
        onError={(e) => {
          const src = e.currentTarget.src || "";
          try {
            e.currentTarget.style.display = "none";
          } catch {}
          if (src && src.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(src);
            } catch (err) {
              // игнорируем
            }
          }
          if (uid) setAvatarError(uid, true);
        }}
        onLoad={() => {
          if (uid) setAvatarError(uid, false);
        }}
      />
    );
  };

  // Подключение сокета и обработчиков
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const chatServerUrl =
      process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:3002";

    const newSocket = io(chatServerUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    // Помощник для отправки, проверяющий подключение сокета
    const safeEmit = (evt, payload) => {
      try {
        if (newSocket && newSocket.connected) newSocket.emit(evt, payload);
      } catch (e) {
        console.warn("Ошибка отправки", evt, e);
      }
    };

    newSocket.on("connect", () => {
      setIsConnected(true);
      setIsLoading(false);

      safeEmit("user_online", {
        userId: toId(currentUser.id),
        username: currentUser.username,
      });

      safeEmit("join_chat", {
        targetUserId: toId(targetUser.id),
        currentUserId: toId(currentUser.id),
      });

      // Просим сервер отметить сообщения как прочитанные для этого чата сразу
      safeEmit("mark_messages_as_read", { targetUserId: toId(targetUser.id) });
      // Также запрашиваем глобальные счетчики непрочитанных для обновления UI
      safeEmit("request_unread_counts");
    });

    // Список онлайн-пользователей
    newSocket.on("online_users", (users) => {
      try {
        const set = new Set((users || []).map((u) => String(u)));
        setOnlineUsers(set);
      } catch (e) {
        console.error("Ошибка парсинга online_users", e);
      }
    });

    newSocket.on("user_online", (userData) => {
      setOnlineUsers((prev) => {
        const s = new Set(prev);
        s.add(String(userData.userId));
        return s;
      });
    });

    newSocket.on("user_offline", (userData) => {
      setOnlineUsers((prev) => {
        const s = new Set(prev);
        s.delete(String(userData.userId));
        return s;
      });
    });

    newSocket.on("chat_history", (data) => {
      try {
        const rawMessages = data.messages || [];

        const processed = rawMessages
          .map((raw, index) => {
            let m = raw;
            if (typeof raw === "string") {
              try {
                m = JSON.parse(raw);
              } catch {
                return null;
              }
            }
            if (!m) return null;

            // Нормализация полей в строки
            m.id = m.id ? String(m.id) : undefined;
            m.tempId = m.tempId ? String(m.tempId) : undefined;
            m.senderId =
              m.senderId !== undefined ? String(m.senderId) : undefined;
            m.senderUsername = m.senderUsername
              ? String(m.senderUsername)
              : m.senderUsername;
            m.timestamp = m.timestamp ? m.timestamp : new Date().toISOString();

            return m;
          })
          .filter(Boolean);

        // Удаление дубликатов по id/tempId/контенту/временному окну
        const unique = [];
        const seen = new Set();
        for (const m of processed) {
          const uid =
            m.id || m.tempId || `${m.senderId}:${m.timestamp}:${m.content}`;
          if (!seen.has(uid)) {
            seen.add(uid);
            unique.push(m);
          }
        }

        setMessages(unique);
      } catch (e) {
        console.error("Ошибка обработчика chat_history", e);
        setMessages([]);
      } finally {
        setIsLoading(false);
        // После загрузки истории сообщаем серверу, что мы отметили как прочитанные
        try {
          newSocket.emit("mark_messages_as_read", {
            targetUserId: toId(targetUser.id),
          });
        } catch (e) {}
      }
    });

    newSocket.on("new_message", (rawMessage) => {
      try {
        let m = rawMessage;
        if (typeof rawMessage === "string") {
          try {
            m = JSON.parse(rawMessage);
          } catch {
            return;
          }
        }
        // Нормализация
        m.id = m.id ? String(m.id) : undefined;
        m.tempId = m.tempId ? String(m.tempId) : undefined;
        m.senderId = m.senderId !== undefined ? String(m.senderId) : undefined;
        m.senderUsername = m.senderUsername
          ? String(m.senderUsername)
          : m.senderUsername;
        m.timestamp = m.timestamp ? m.timestamp : new Date().toISOString();

        // Добавляем только сообщения, принадлежащие этой комнате
        const sender = toId(m.senderId);
        const targetIs = toId(targetUser.id);
        const meIs = toId(currentUser.id);
        if (sender !== targetIs && sender !== meIs) {
          return;
        }

        setMessages((prev) => {
          // Проверка на дубликаты
          const dup = prev.some((msg) => {
            if (msg.id && m.id && msg.id === m.id) return true;
            if (msg.tempId && m.tempId && msg.tempId === m.tempId) return true;
            if (msg.content === m.content && msg.senderId === m.senderId) {
              const t1 = new Date(msg.timestamp || 0).getTime();
              const t2 = new Date(m.timestamp || 0).getTime();
              return Math.abs(t1 - t2) < 5000;
            }
            return false;
          });
          if (dup) return prev;

          // Добавляем новое сообщение независимо от очистки истории
          return [...prev, m];
        });
      } catch (e) {
        console.error("Ошибка обработчика new_message", e);
      }
    });

    newSocket.on("message_sent", (message) => {
      try {
        const m = {
          ...message,
          id: message.id ? String(message.id) : undefined,
          tempId: message.tempId ? String(message.tempId) : undefined,
          senderId: message.senderId ? String(message.senderId) : undefined,
          timestamp: message.timestamp
            ? message.timestamp
            : new Date().toISOString(),
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === m.tempId
              ? { ...msg, id: m.id, timestamp: m.timestamp, isSending: false }
              : msg
          )
        );
      } catch (e) {
        console.error("Ошибка обработчика message_sent", e);
      }
    });

    newSocket.on("message_edited", (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.id) === String(data.messageId)
            ? {
                ...msg,
                content: data.newContent,
                isEdited: true,
                editTimestamp: data.timestamp,
              }
            : msg
        )
      );
      setEditingMessage(null);
      setEditText("");
    });

    newSocket.on("message_deleted", (data) => {
      if (data.deleteForEveryone) {
        setMessages((prev) =>
          prev.filter((m) => String(m.id) !== String(data.messageId))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(data.messageId)
              ? { ...m, deletedForMe: true, content: "Сообщение удалено" }
              : m
          )
        );
      }
      setShowDeleteMenu(null);
    });

    newSocket.on("chat_history_cleared", () => {
      setMessages([]);
    });

    newSocket.on("user_typing", (data) => {
      setTypingUsers((prev) => {
        const filtered = prev.filter(
          (u) => String(u.userId) !== String(data.userId)
        );
        return [
          ...filtered,
          { userId: String(data.userId), username: data.username },
        ];
      });
    });

    newSocket.on("user_stop_typing", (data) => {
      setTypingUsers((prev) =>
        prev.filter((u) => String(u.userId) !== String(data.userId))
      );
    });

    newSocket.on("error", (err) => {
      console.error("Ошибка сокета", err);
      setIsLoading(false);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    const handleBeforeUnload = () => {
      try {
        if (newSocket && newSocket.connected) {
          newSocket.emit("user_offline", { userId: toId(currentUser.id) });
        }
      } catch (e) {}
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      try {
        if (newSocket && newSocket.connected) {
          newSocket.emit("user_offline", { userId: toId(currentUser.id) });
        }
      } catch (e) {}
      window.removeEventListener("beforeunload", handleBeforeUnload);

      try {
        newSocket.close();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser.id, currentUser.id]);

  // Обработчики клика снаружи
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        messageMenuRef.current &&
        !messageMenuRef.current.contains(event.target)
      )
        setShowDeleteMenu(null);
      if (
        headerMenuRef.current &&
        !headerMenuRef.current.contains(event.target)
      )
        setShowHeaderMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !isConnected) return;

    const tempId =
      Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const timestamp = new Date().toISOString();

    const optimisticMessage = {
      id: `temp-${tempId}`,
      tempId: String(tempId),
      senderId: String(currentUser.id),
      senderUsername: currentUser.username,
      content: newMessage.trim(),
      timestamp,
      isRead: false,
      isSending: true,
    };

    setMessages((prev) => {
      const exists = prev.some((m) => m.tempId === optimisticMessage.tempId);
      return exists ? prev : [...prev, optimisticMessage];
    });

    setNewMessage("");

    try {
      socket.emit("send_message", {
        targetUserId: toId(targetUser.id),
        content: optimisticMessage.content,
        tempId: optimisticMessage.tempId,
      });
    } catch (e) {
      console.error("Ошибка отправки", e);
    }

    try {
      socket.emit("typing_stop", { targetUserId: toId(targetUser.id) });
    } catch {}
  };

  const startEditing = (message) => {
    setEditingMessage(message.id);
    setEditText(message.content);
    setShowDeleteMenu(null);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditText("");
  };

  const saveEditedMessage = () => {
    if (!editText.trim() || !socket || !isConnected || !editingMessage) return;
    socket.emit("edit_message", {
      messageId: editingMessage,
      newContent: editText.trim(),
      targetUserId: toId(targetUser.id),
    });
  };

  const deleteMessage = (messageId, deleteForEveryone = false) => {
    if (socket && isConnected) {
      socket.emit("delete_message", {
        messageId,
        targetUserId: toId(targetUser.id),
        deleteForEveryone,
      });
    }
    setShowDeleteMenu(null);
  };

  const clearChatHistory = () => {
    if (socket && isConnected) {
      socket.emit("clear_chat_history", { targetUserId: toId(targetUser.id) });
    }
    setShowHeaderMenu(false);
  };

  const isUserOnline = (userId) => onlineUsers.has(String(userId));

  const handleTyping = () => {
    if (!socket || !isConnected) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit("typing_start", {
      targetUserId: toId(targetUser.id),
      username: currentUser.username,
    });
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", { targetUserId: toId(targetUser.id) });
    }, 2000);
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) handleTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) saveEditedMessage();
      else sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return "--:--";
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "--:--";
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "--:--";
    }
  };

  const formatDate = (timestamp) => {
    try {
      if (!timestamp) return "Неизвестная дата";
      const md = new Date(timestamp);
      if (isNaN(md.getTime())) return "Неизвестная дата";
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (md.toDateString() === today.toDateString()) return "Сегодня";
      if (md.toDateString() === yesterday.toDateString()) return "Вчера";
      return md.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: md.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return "Неизвестная дата";
    }
  };

  const groupMessagesByDate = () => {
    const groups = [];
    let currentDate = null;
    const seen = new Set();

    messages.forEach((message, index) => {
      if (message.deletedForMe) return;
      const uid = message.id || message.tempId || `idx-${index}`;
      if (seen.has(uid)) return;
      seen.add(uid);

      const messageDate = formatDate(message.timestamp);
      if (messageDate !== currentDate) {
        const dateKey = `date-${messageDate}-${index}-${Math.random()
          .toString(36)
          .substr(2, 5)}`;
        groups.push({ type: "date", value: messageDate, key: dateKey });
        currentDate = messageDate;
      }
      const messageKey = `msg-${uid}-${
        message.timestamp || Date.now()
      }-${index}`;
      groups.push({ type: "message", value: message, key: messageKey });
    });

    return groups;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Загрузка чата...</p>
        {unreadCount > 0 && (
          <div className="mt-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            Непрочитанных сообщений: {unreadCount}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-lg">
                {getAvatarUrl(targetUser.avatar_url) ? (
                  <RenderAvatar user={targetUser} sizeClass="w-12 h-12" imgClass="w-full h-full object-cover" />
                ) : (
                  <DefaultAvatar className="w-12 h-12" />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 text-lg truncate">
                {targetUser.name}
              </h2>
              <p className="text-sm text-gray-500 flex items-center truncate">
                <span
                  className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                    isUserOnline(targetUser.id)
                      ? "bg-green-500 animate-pulse"
                      : "bg-gray-400"
                  }`}
                />
                <span className="truncate">
                  {isUserOnline(targetUser.id) ? "В сети" : "Не в сети"}
                  {typingUsers.some(
                    (u) => String(u.userId) === String(targetUser.id)
                  ) && " • Печатает..."}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 flex-shrink-0">
            <div className="relative" ref={headerMenuRef}>
              <button
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
                title="Действия с чатом"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <button
                      onClick={clearChatHistory}
                      className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                      <span>Очистить историю</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-lg font-medium">Нет сообщений</p>
            <p className="text-sm">Начните общение первым!</p>
            {unreadCount > 0 && (
              <div className="mt-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                Непрочитанных сообщений: {unreadCount}
              </div>
            )}
          </div>
        ) : (
          groupMessagesByDate().map((item) => {
            if (item.type === "date") {
              return (
                <div key={item.key} className="flex justify-center">
                  <div className="bg-gray-200 rounded-full px-3 py-1">
                    <span className="text-xs text-gray-600 font-medium">
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            }

            const message = item.value;
            if (!message) return null;

            const isOwnMessage =
              String(message.senderId) === String(currentUser.id);
            const isDeleted = message.deletedForMe;
            const canEdit = isOwnMessage && !isDeleted && !message.isSending;
            const canDelete = !isDeleted && !message.isSending;

            return (
              <div
                key={item.key}
                className={`flex ${
                  isOwnMessage ? "justify-end" : "justify-start"
                } group relative`}
              >
                <div
                  className={`flex max-w-[70%] ${
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  } items-end space-x-2 relative`}
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {isOwnMessage ? (
                        getAvatarUrl(currentUser.avatar_url) ? (
                          <RenderAvatar
                            user={currentUser}
                            sizeClass="w-8 h-8"
                            imgClass="w-full h-full object-cover"
                          />
                        ) : (
                          <DefaultAvatar className="w-6 h-6" />
                        )
                      ) : getAvatarUrl(targetUser.avatar_url) ? (
                        <RenderAvatar
                          user={targetUser}
                          sizeClass="w-8 h-8"
                          imgClass="w-full h-full object-cover"
                        />
                      ) : (
                        <DefaultAvatar className="w-6 h-6" />
                      )}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2 relative ${
                      isOwnMessage
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-none"
                        : "bg-white text-gray-900 border border-gray-200 rounded-bl-none shadow-sm"
                    } ${message.isSending ? "opacity-80" : ""} ${
                      isDeleted ? "opacity-60 italic" : ""
                    }`}
                  >
                    {editingMessage === message.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="bg-transparent border-b border-white/50 focus:outline-none flex-1"
                          autoFocus
                        />
                        <div className="flex space-x-1">
                          <button
                            onClick={saveEditedMessage}
                            className="p-1 hover:bg-white/20 rounded"
                            title="Сохранить"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 hover:bg-white/20 rounded"
                            title="Отменить"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed">
                          {isDeleted ? "Сообщение удалено" : message.content}
                        </p>
                        <div
                          className={`flex items-center justify-end space-x-1 mt-1 ${
                            isOwnMessage ? "text-blue-100" : "text-gray-400"
                          }`}
                        >
                          {message.isEdited && (
                            <span className="text-xs mr-1">(ред.)</span>
                          )}
                          <span
                            className="text-xs"
                            title={message.timestamp || "Время не указано"}
                          >
                            {formatTime(message.timestamp)}
                          </span>
                          {isOwnMessage && !isDeleted && (
                            <>
                              {message.isSending ? (
                                <div className="w-3 h-3 border-2 border-blue-200 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <span className="text-xs">
                                  {message.isRead ? "✓✓" : "✓"}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {canDelete && (
                    <div
                      ref={messageMenuRef}
                      className={`absolute ${
                        isOwnMessage ? "left-0 -ml-8" : "right-0 -mr-8"
                      } top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                    >
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowDeleteMenu(
                              showDeleteMenu === message.id ? null : message.id
                            )
                          }
                          className="p-1.5 bg-white rounded-full shadow-md border border-gray-200 text-gray-500 hover:text-gray-700 hover:shadow-lg transition-all"
                          title="Действия с сообщением"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {showDeleteMenu === message.id && (
                          <div
                            className={`absolute ${
                              isOwnMessage ? "right-0" : "left-0"
                            } mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10`}
                          >
                            <div className="p-2">
                              {canEdit && (
                                <button
                                  onClick={() => startEditing(message)}
                                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span>Редактировать</span>
                                </button>
                              )}
                              {isOwnMessage && (
                                <>
                                  <button
                                    onClick={() =>
                                      deleteMessage(message.id, false)
                                    }
                                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Удалить для меня</span>
                                  </button>
                                  <button
                                    onClick={() =>
                                      deleteMessage(message.id, true)
                                    }
                                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Удалить для всех</span>
                                  </button>
                                </>
                              )}
                              {!isOwnMessage && (
                                <button
                                  onClick={() =>
                                    deleteMessage(message.id, false)
                                  }
                                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  <UserX className="w-4 h-4" />
                                  <span>Удалить у себя</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {typingUsers.map((user) => (
          <div key={user.userId} className="flex justify-start">
            <div className="flex items-end space-x-2 max-w-[70%]">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                {/* Для индикатора набора текста показываем аватар по умолчанию для собеседника */}
                <DefaultAvatar className="w-6 h-6" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 border border-gray-200">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-4 sticky bottom-0 w-full">
        <div className="flex items-center space-x-3">

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Напишите сообщение..."
              className="w-full bg-gray-100 rounded-full px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              disabled={!isConnected}
            />
          </div>

          <button
            onClick={editingMessage ? saveEditedMessage : sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className={`p-3 rounded-full transition-all duration-200 ${
              newMessage.trim() && isConnected
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transform hover:scale-105"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            title={
              editingMessage ? "Сохранить изменения" : "Отправить сообщение"
            }
          >
            {editingMessage ? (
              <Check className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>

          {editingMessage && (
            <button
              onClick={cancelEditing}
              className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
              title="Отменить редактирование"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {editingMessage && (
          <div className="text-center mt-2">
            <p className="text-sm text-blue-500">Редактирование сообщения</p>
          </div>
        )}
        {!isConnected && (
          <div className="text-center mt-2">
            <p className="text-sm text-red-500">Нет подключения к чату</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;