require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const redis = require("redis");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true,
  })
);

const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3001",
      "http://127.0.0.1:3001", // для Windows
      "http://localhost:3000",
      "http://127.0.0.1:3000", // для Windows
      "http://frontend:3000",
      "http://host.docker.internal:3001",
      "http://host.docker.internal:3000",
    ],
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:3001",
      "http://localhost:3000",
      "http://frontend:3000",
      "http://chat_server:3002",
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

const PORT = process.env.PORT || 3002;

// Прочие секреты: основной JWT_SECRET и запасной RAILS_SECRET_KEY_BASE (для совместимости с Rails)
const JWT_SECRET = process.env.JWT_SECRET || null;
const RAILS_SECRET_KEY_BASE = process.env.RAILS_SECRET_KEY_BASE || null;

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  // console.log("Redis Client Error:", err.message);
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    // console.log("Connected to Redis");
  } catch (err) {
    // console.log("Redis connection failed:", err.message);
  }
};

connectRedis();

app.use(express.json());

// Хелперы
const getRoomId = (user1Id, user2Id) => {
  return [String(user1Id), String(user2Id)].sort().join("_");
};

const saveMessage = async (roomId, message) => {
  try {
    const key = `chat:${roomId}:messages`;
    await redisClient.lPush(key, JSON.stringify(message));
    await redisClient.lTrim(key, 0, 999);
  } catch (err) {
    // console.log("Error saving message:", err.message);
  }
};

const getMessages = async (roomId, currentUserId = null, limit = 100) => {
  try {
    const key = `chat:${roomId}:messages`;
    const messages = await redisClient.lRange(key, 0, limit - 1);

    const processedMessages = messages
      .map((msg) => {
        try {
          return JSON.parse(msg);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();

    // Если передан currentUserId, применяем фильтры
    if (currentUserId) {
      const filteredMessages = [];

      // Проверяем, очищена ли история для этого пользователя
      const clearedHistoryKey = `chat:${roomId}:cleared:${currentUserId}`;
      const clearedTimestamp = await redisClient.get(clearedHistoryKey);

      for (const message of processedMessages) {
        // Пропускаем сообщения, которые были до очистки истории
        if (
          clearedTimestamp &&
          new Date(message.timestamp) < new Date(clearedTimestamp)
        ) {
          continue;
        }

        // Проверяем, не удалено ли сообщение для этого пользователя
        const deletedMessageKey = `chat:${roomId}:deleted:${currentUserId}:${message.id}`;
        const isDeleted = await redisClient.get(deletedMessageKey);

        if (!isDeleted) {
          filteredMessages.push(message);
        }
      }

      return filteredMessages;
    }

    return processedMessages;
  } catch (err) {
    // console.log("Error getting messages:", err.message);
    return [];
  }
};

// ВСПОМОГАТЕЛЬ: пытается верифицировать токен по нескольким секретам.
// Возвращает распарсенный payload или бросает ошибку.
function verifyJwt(token) {
  // Перечень кандидатных секретов в порядке приоритета
  const candidates = [];
  if (JWT_SECRET) candidates.push({ name: "JWT_SECRET", secret: JWT_SECRET });
  if (RAILS_SECRET_KEY_BASE)
    candidates.push({
      name: "RAILS_SECRET_KEY_BASE",
      secret: RAILS_SECRET_KEY_BASE,
    });

  // Если нет ни одного секрета — бросаем
  if (candidates.length === 0) {
    throw new Error("No JWT secret configured on server");
  }

  // Попробуем верифицировать токен по каждому из кандидатов
  let lastError = null;
  for (const c of candidates) {
    try {
      const decoded = jwt.verify(token, c.secret, { algorithms: ["HS256"] });
      // console.log(`✅ JWT verified using ${c.name}`);
      return { decoded, usedSecret: c.name };
    } catch (err) {
      lastError = err;
      // console.warn(`🔑 JWT verification with ${c.name} failed:`, err.message);
      // пробуем следующий секрет
    }
  }

  // ничего не подошло
  const message = lastError ? lastError.message : "Authentication error";
  const err = new Error(message);
  err.name = "JsonWebTokenError";
  throw err;
}

// Normalize socket auth -> strings
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: token missing"));

    const { decoded } = verifyJwt(token);
    // Поддерживаем оба варианта ключа в payload: user_id или user_id (Rails -> user_id)
    socket.userId = String(decoded.user_id || decoded.userId || decoded.sub || "");
    socket.username = decoded.username ? String(decoded.username) : "";
    if (!socket.userId) {
      // console.warn("JWT decoded but user id not found in payload", decoded);
      return next(new Error("Authentication error: user id missing"));
    }
    next();
  } catch (err) {
    // console.error("JWT verification failed in socket auth:", err.message);
    next(new Error("Authentication error"));
  }
});

// Отслеживание онлайн-пользователей: Map<userId, { userId, username, socketId }>
const onlineUsers = new Map();

io.on("connection", (socket) => {
  // console.log(`User ${socket.username} (${socket.userId}) connected`);

  // Хелпер: найти все сокеты по userId (строковое сравнение)
  function findSocketsByUserId(userId) {
    const uid = String(userId);
    const sockets = [];
    for (let [sockId, s] of io.of("/").sockets) {
      try {
        if (String(s.userId) === uid) sockets.push(s);
      } catch (e) {}
    }
    return sockets;
  }

  // Хелпер: получить персистентные счётчики непрочитанных и lastMessages для пользователя
  async function getPersistentUnreadForUser(userId) {
    const pattern = `chat:unread_count:${userId}:*`;
    const keys = await redisClient.keys(pattern);
    const unreadCounts = {};
    for (const key of keys) {
      try {
        // key = chat:unread_count:<userId>:<senderId>
        const parts = key.split(":");
        const senderId = parts[3];
        const val = await redisClient.get(key);
        const num = val ? parseInt(val, 10) : 0;
        if (num > 0) unreadCounts[senderId] = num;
      } catch (e) {
        // console.error("getPersistentUnreadForUser error:", e);
      }
    }
    return unreadCounts;
  }

  async function getPersistentLastMessagesForUser(userId) {
    const pattern = `chat:last_message:${userId}:*`;
    const keys = await redisClient.keys(pattern);
    const lastMessages = {};
    for (const key of keys) {
      try {
        // key = chat:last_message:<userId>:<senderId>
        const parts = key.split(":");
        const senderId = parts[3];
        const val = await redisClient.get(key);
        if (val !== null) lastMessages[senderId] = val;
      } catch (e) {
        // console.error("getPersistentLastMessagesForUser error:", e);
      }
    }
    return lastMessages;
  }

  // Присоединиться к комнате чата и отдать историю
  socket.on("join_chat", async (data) => {
    try {
      const targetUserId = String(data.targetUserId);
      const currentUserId = String(socket.userId);
      const roomId = getRoomId(currentUserId, targetUserId);

      socket.join(roomId);
      // console.log(`User ${currentUserId} joined room ${roomId}`);

      // Передаем currentUserId для правильной фильтрации
      const messages = await getMessages(roomId, currentUserId);
      socket.emit("chat_history", { roomId, messages });

      // Сразу отмечаем сообщения как прочитанные для этого пользователя в этой комнате
      const lastReadKey = `chat:${roomId}:last_read:${currentUserId}`;
      await redisClient.set(lastReadKey, new Date().toISOString());

      // Также очищаем персистентный счётчик unread для этой пары (получатель=currentUserId, отправитель=targetUserId)
      const unreadKey = `chat:unread_count:${currentUserId}:${targetUserId}`;
      try {
        await redisClient.del(unreadKey);
      } catch (e) {
        // console.error("Failed to clear unread key on join:", e);
      }

      // После отметки как прочитанные, отправим обновлённые персистентные данные пользователю:
      const unreadCounts = await getPersistentUnreadForUser(currentUserId);
      const lastMessages = await getPersistentLastMessagesForUser(currentUserId);

      socket.emit("unread_counts_updated", { unreadCounts, lastMessages });
    } catch (err) {
      // console.error("join_chat error:", err);
    }
  });

  // Клиент просит текущие счётчики непрочитанных
  socket.on("request_unread_counts", async () => {
    try {
      const currentUserId = String(socket.userId);

      // Сначала пытаемся прочитать персистентные счётчики (быстро)
      const unreadCounts = await getPersistentUnreadForUser(currentUserId);
      const lastMessages = await getPersistentLastMessagesForUser(currentUserId);

      // Если персистентных ключей нет, делаем fallback по спискам сообщений (backcompat)
      // Также объединим: персистентные ключи имеют приоритет
      const pattern = `chat:*${currentUserId}*:messages`;
      const keys = await redisClient.keys(pattern);

      for (const key of keys) {
        try {
          const room = key.split(":")[1];
          const userIds = room.split("_");
          const other = userIds[0] === currentUserId ? userIds[1] : userIds[0];

          // Если у нас уже есть персистентное lastMessage для этого собеседника — пропускаем вычисление
          if (lastMessages[other] !== undefined) continue;

          const raw = await redisClient.lRange(key, 0, -1);
          if (!raw || raw.length === 0) continue;

          const parsed = raw
            .map((r) => {
              try {
                return JSON.parse(r);
              } catch (e) {
                return null;
              }
            })
            .filter(Boolean);
          if (parsed.length === 0) continue;

          // находим самое новое сообщение
          let newest = parsed[0];
          for (const m of parsed) {
            try {
              if (
                new Date(m.timestamp).getTime() >
                new Date(newest.timestamp).getTime()
              )
                newest = m;
            } catch (e) {}
          }
          if (newest && newest.content) lastMessages[other] = newest.content;

          // если у нас уже есть персистентный unread для этого собеседника — пропускаем
          const unreadKey = `chat:unread_count:${currentUserId}:${other}`;
          const pval = await redisClient.get(unreadKey);
          if (pval !== null) {
            // уже учтён в персистентной карте
            continue;
          }

          // fallback: вычисление по last_read
          const lastReadTs = await redisClient.get(
            `chat:${room}:last_read:${currentUserId}`
          );
          let unread = 0;
          if (!lastReadTs) {
            for (const m of parsed) if (m.senderId === other) unread++;
          } else {
            const lr = new Date(lastReadTs).getTime();
            for (const m of parsed) {
              try {
                const mt = new Date(m.timestamp).getTime();
                if (m.senderId === other && mt > lr) unread++;
              } catch (e) {}
            }
          }
          if (unread > 0) {
            // добавляем во временный результат, но не персистим
            unreadCounts[other] = unread;
          }
        } catch (e) {
          // console.error("request_unread_counts room error:", e);
        }
      }

      socket.emit("unread_counts_updated", { unreadCounts, lastMessages });
    } catch (err) {
      // console.error("request_unread_counts error:", err);
    }
  });

  // Отметить сообщения как прочитанные (через сокет)
  socket.on("mark_messages_as_read", async (data) => {
    try {
      const targetUserId = String(data.targetUserId);
      const currentUserId = String(socket.userId);
      const roomId = getRoomId(currentUserId, targetUserId);

      const lastReadKey = `chat:${roomId}:last_read:${currentUserId}`;
      await redisClient.set(lastReadKey, new Date().toISOString());

      // Очистить персистентный счётчик unread для этой пары
      const unreadKey = `chat:unread_count:${currentUserId}:${targetUserId}`;
      await redisClient.del(unreadKey).catch((e) => {
        // console.error("Failed to del unreadKey in mark_messages_as_read:", e);
      });

      // Пересчитаем персистентную карту и отправим обновление всем сокетам пользователя
      const unreadCounts = await getPersistentUnreadForUser(currentUserId);
      const lastMessages = await getPersistentLastMessagesForUser(currentUserId);

      const socketsForUser = findSocketsByUserId(currentUserId);
      socketsForUser.forEach((s) => {
        s.emit("unread_counts_updated", {
          unreadCounts,
          lastMessages,
          updatedBy: currentUserId,
        });
      });
    } catch (err) {
      // console.error("mark_messages_as_read error:", err);
    }
  });

  // Отправка сообщения
  socket.on("send_message", async (data) => {
    try {
      const targetUserId = String(data.targetUserId);
      const content = data.content;
      const tempId = data.tempId ? String(data.tempId) : undefined;
      const roomId = getRoomId(socket.userId, targetUserId);

      const message = {
        id: Date.now().toString(),
        tempId: tempId,
        senderId: String(socket.userId),
        senderUsername: socket.username,
        content,
        timestamp: new Date().toISOString(),
        roomId,
      };

      // сохраняем сообщение
      await saveMessage(roomId, message);

      // 1) Отправляем новое сообщение всем в комнате (универсально)
      io.to(roomId).emit("new_message", message);

      // 2) Персистентно инкрементим unread для получателя и сохраняем last_message
      try {
        const unreadKey = `chat:unread_count:${targetUserId}:${message.senderId}`;
        const lastMsgKey = `chat:last_message:${targetUserId}:${message.senderId}`;

        await redisClient.incr(unreadKey);
        await redisClient.expire(unreadKey, 60 * 60 * 24 * 30);

        await redisClient.set(lastMsgKey, message.content || "");
        await redisClient.expire(lastMsgKey, 60 * 60 * 24 * 30);
      } catch (e) {
        // console.error("Redis unread/last_message update failed:", e);
      }

      // 3) Для получателя: обновляем запись списка чатов, где userId = id отправителя
      const targetSockets = findSocketsByUserId(targetUserId);
      const senderIdStr = String(socket.userId);
      targetSockets.forEach((ts) => {
        ts.emit("new_unread_message", {
          senderId: senderIdStr,
          message: content,
          timestamp: message.timestamp,
        });

        // Для получателя userId = senderId (обновляем карточку отправителя в списке получателя)
        ts.emit("chat_list_update", {
          senderId: senderIdStr,
          userId: senderIdStr,
          lastMessage: content,
          timestamp: message.timestamp,
        });

        // Также опционально отправим свежие персистентные карты unread/lastMessages
        (async () => {
          try {
            const unreadMap = await getPersistentUnreadForUser(targetUserId);
            const lastMsgs = await getPersistentLastMessagesForUser(targetUserId);
            ts.emit("unread_counts_updated", { unreadCounts: unreadMap, lastMessages: lastMsgs });
          } catch (e) {
            // console.error("Failed to push persistent unread map to target socket:", e);
          }
        })();
      });

      // 4) Для отправителя: обновляем его список чатов — запись, соответствующая целевому пользователю
      const senderSockets = findSocketsByUserId(socket.userId);
      senderSockets.forEach((ss) => {
        ss.emit("chat_list_update", {
          senderId: senderIdStr,
          userId: targetUserId,
          lastMessage: content,
          timestamp: message.timestamp,
          unreadCount: 0,
        });
      });

      // 5) Подтверждение отправителю (оригинальный сокет)
      socket.emit("message_sent", message);
    } catch (err) {
      // console.error("send_message error:", err);
    }
  });

  // Обработчики редактирования / удаления / набора текста (логика сохранена)
  socket.on("edit_message", async (data) => {
    try {
      const { messageId, newContent, targetUserId } = data;
      const currentUserId = String(socket.userId);
      const roomId = getRoomId(currentUserId, String(targetUserId));

      // Находим и обновляем сообщение в Redis
      const key = `chat:${roomId}:messages`;
      const rawMessages = await redisClient.lRange(key, 0, -1);

      let found = false;
      const updatedMessages = rawMessages.map((rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg);
          if (msg.id === String(messageId) && msg.senderId === currentUserId) {
            found = true;
            return JSON.stringify({
              ...msg,
              content: newContent,
              isEdited: true,
              editTimestamp: new Date().toISOString(),
            });
          }
          return rawMsg;
        } catch (e) {
          return rawMsg;
        }
      });

      if (found) {
        // Перезаписываем список сообщений
        await redisClient.del(key);
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          await redisClient.lPush(key, updatedMessages[i]);
        }

        // Отправляем обновление всем в комнате
        const payload = {
          messageId: String(messageId),
          newContent,
          timestamp: new Date().toISOString(),
        };
        io.to(roomId).emit("message_edited", payload);
      }
    } catch (err) {
      // console.error("edit_message error:", err);
    }
  });

  socket.on("clear_chat_history", async (data) => {
    try {
      const { targetUserId } = data;
      const currentUserId = String(socket.userId);
      const roomId = getRoomId(currentUserId, String(targetUserId));

      // console.log(`🧹 Очистка истории: ${currentUserId} -> ${targetUserId}`);

      // 1. Устанавливаем метку очистки истории
      const clearedHistoryKey = `chat:${roomId}:cleared:${currentUserId}`;
      const clearTimestamp = new Date().toISOString();
      await redisClient.set(clearedHistoryKey, clearTimestamp);
      await redisClient.expire(clearedHistoryKey, 60 * 60 * 24 * 30);

      // 2. Очищаем персистентные ключи last_message и unread для этого пользователя-пары
      const lastMessageKey = `chat:last_message:${currentUserId}:${targetUserId}`;
      const unreadKey = `chat:unread_count:${currentUserId}:${targetUserId}`;
      try {
        await redisClient.set(lastMessageKey, "");
        await redisClient.expire(lastMessageKey, 60 * 60 * 24 * 30);
        await redisClient.del(unreadKey);
      } catch (e) {
        // console.error("Error clearing persistent keys on clear_chat_history:", e);
      }

      socket.emit("chat_history_cleared");

      // 3. Отправляем события для обновления UI
      const userSockets = findSocketsByUserId(currentUserId);

      userSockets.forEach((userSocket) => {
        // Событие для обновления списка чатов
        userSocket.emit("chat_list_update", {
          senderId: currentUserId,
          userId: targetUserId,
          lastMessage: "", // ПУСТАЯ строка
          timestamp: clearTimestamp,
          unreadCount: 0,
        });
      });

      // 4. Обновляем историю в активном чате
      const filteredMessages = await getMessages(roomId, currentUserId);
      userSockets.forEach((userSocket) => {
        if (userSocket.rooms.has(roomId)) {
          userSocket.emit("chat_history", {
            roomId,
            messages: filteredMessages,
          });
        }
      });

      // console.log(`История очищена, последнее сообщение сброшено`);
    } catch (err) {
      // console.error("clear_chat_history error:", err);
    }
  });

  socket.on("delete_message", async (data) => {
    try {
      const { messageId, targetUserId, deleteForEveryone } = data;
      const currentUserId = String(socket.userId);
      const roomId = getRoomId(currentUserId, String(targetUserId));

      if (deleteForEveryone) {
        // Удаляем для всех участников
        const key = `chat:${roomId}:messages`;
        const rawMessages = await redisClient.lRange(key, 0, -1);

        const filteredMessages = rawMessages.filter((rawMsg) => {
          try {
            const msg = JSON.parse(rawMsg);
            return msg.id !== String(messageId);
          } catch (e) {
            return true;
          }
        });

        // Перезаписываем список сообщений
        await redisClient.del(key);
        for (let i = filteredMessages.length - 1; i >= 0; i--) {
          await redisClient.lPush(key, filteredMessages[i]);
        }

        // Уведомляем всех в комнате
        io.to(roomId).emit("message_deleted", {
          messageId,
          deleteForEveryone: true,
          deletedBy: currentUserId,
        });
      } else {
        // Удаляем только для текущего пользователя
        // Сохраняем информацию об удаленном сообщении
        const deletedMessageKey = `chat:${roomId}:deleted:${currentUserId}:${messageId}`;
        await redisClient.set(deletedMessageKey, new Date().toISOString());

        // Уведомляем только текущего пользователя
        socket.emit("message_deleted", {
          messageId,
          deleteForEveryone: false,
          deletedBy: currentUserId,
        });
      }
    } catch (err) {
      // console.error("delete_message error:", err);
    }
  });

  socket.on("typing_start", (data) => {
    const { targetUserId } = data;
    const roomId = getRoomId(String(socket.userId), String(targetUserId));
    socket.to(roomId).emit("user_typing", {
      userId: String(socket.userId),
      username: socket.username,
    });
  });

  socket.on("typing_stop", (data) => {
    const { targetUserId } = data;
    const roomId = getRoomId(String(socket.userId), String(targetUserId));
    socket
      .to(roomId)
      .emit("user_stop_typing", { userId: String(socket.userId) });
  });

  // События user_online / user_offline от клиента
  socket.on("user_online", (userData) => {
    const uid = String(userData.userId);
    onlineUsers.set(uid, {
      userId: uid,
      username: String(userData.username),
      socketId: socket.id,
    });
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("user_offline", (userData) => {
    const uid = String(userData.userId);
    onlineUsers.delete(uid);
    io.emit("online_users", Array.from(onlineUsers.keys()));
    io.emit("user_offline", { userId: uid });
  });

  // Очистка при отключении
  socket.on("disconnect", () => {
    // удаляем из onlineUsers map при необходимости
    for (let [uid, data] of onlineUsers.entries()) {
      if (data.socketId === socket.id) {
        onlineUsers.delete(uid);
        io.emit("online_users", Array.from(onlineUsers.keys()));
        io.emit("user_offline", { userId: uid });
        break;
      }
    }
    // console.log(`User ${socket.username} (${socket.userId}) disconnected`);
  });
});

// HTTP endpoints
app.get("/health", async (req, res) => {
  try {
    const redisStatus = redisClient.isOpen ? "connected" : "disconnected";
    if (redisClient.isOpen) await redisClient.ping();
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      redis: redisStatus,
    });
  } catch (error) {
    res.status(500).json({ status: "ERROR", error: error.message });
  }
});

// Вспомогательная функция для извлечения токена из заголовка Authorization
function extractTokenFromHeader(req) {
  const raw = req.headers.authorization || "";
  if (!raw) return null;
  const parts = raw.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

app.get("/api/messages/:targetUserId", async (req, res) => {
  try {
    const token = extractTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    // Пытаемся верифицировать токен любым доступным секретом
    let decoded;
    try {
      decoded = verifyJwt(token).decoded;
    } catch (e) {
      // console.error("JWT verification error in /api/messages:", e.message);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const currentUserId = String(decoded.user_id || decoded.userId || decoded.sub);

    if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = getRoomId(currentUserId, String(req.params.targetUserId));

    // Передаем currentUserId для правильной фильтрации
    const messages = await getMessages(roomId, currentUserId);
    res.json({ messages });
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/unread-count", async (req, res) => {
  try {
    const token = extractTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: "Токен не предоставлен" });

    // Пытаемся верифицировать токен любым доступным секретом
    let decoded;
    try {
      const result = verifyJwt(token);
      decoded = result.decoded;
      // логирование: какой секрет сработал
      // console.log("JWT verified for /api/unread-count using:", result.usedSecret);
    } catch (e) {
      // console.error("JWT verification error in /api/unread-count:", e.message);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const currentUserId = String(decoded.user_id || decoded.userId || decoded.sub);

    // Далее логика как раньше (с персистентными ключами и fallback'ом)
    // Попытка получить персистентные ключи
    const unreadCounts = await (async () => {
      const map = {};
      const pattern = `chat:unread_count:${currentUserId}:*`;
      const keys = await redisClient.keys(pattern);
      for (const key of keys) {
        try {
          const parts = key.split(":");
          const senderId = parts[3];
          const val = await redisClient.get(key);
          const num = val ? parseInt(val, 10) : 0;
          if (num > 0) map[senderId] = num;
        } catch (e) {
          // console.error("Error reading unread key:", e);
        }
      }
      return map;
    })();

    // Последние сообщения через персистентные ключи
    const lastMessages = await (async () => {
      const map = {};
      const pattern = `chat:last_message:${currentUserId}:*`;
      const keys = await redisClient.keys(pattern);
      for (const key of keys) {
        try {
          const parts = key.split(":");
          const senderId = parts[3];
          const val = await redisClient.get(key);
          if (val !== null) map[senderId] = val;
        } catch (e) {
          // console.error("Error reading last_message key:", e);
        }
      }
      return map;
    })();

    // Fallback: если нет персистентных ключей для некоторых чатов — вычислить из истории
    const pattern = `chat:*${currentUserId}*:messages`;
    const keys = await redisClient.keys(pattern);
    for (const key of keys) {
      try {
        const room = key.split(":")[1];
        const userIds = room.split("_");
        const other = userIds[0] === currentUserId ? userIds[1] : userIds[0];

        // Если персистентный lastMessages уже содержит запись - пропускаем вычисление
        if (lastMessages[other] === undefined) {
          const raw = await redisClient.lRange(key, 0, -1);
          if (raw && raw.length > 0) {
            const parsed = raw
              .map((r) => {
                try {
                  return JSON.parse(r);
                } catch (e) {
                  return null;
                }
              })
              .filter(Boolean);
            if (parsed.length > 0) {
              // находим самое новое
              let newest = parsed[0];
              for (const m of parsed) {
                try {
                  if (
                    new Date(m.timestamp).getTime() >
                    new Date(newest.timestamp).getTime()
                  )
                    newest = m;
                } catch (e) {}
              }
              if (newest && newest.content) lastMessages[other] = newest.content;
            }
          }
        }

        // Если персистентный unreadCounts уже содержит запись, пропускаем
        const persistentKey = `chat:unread_count:${currentUserId}:${other}`;
        const pv = await redisClient.get(persistentKey);
        if (pv !== null) {
          // уже обработано через персистентные ключи
          continue;
        }

        // fallback вычисление unread
        const raw = await redisClient.lRange(key, 0, -1);
        if (!raw || raw.length === 0) continue;

        const parsed = raw
          .map((r) => {
            try {
              return JSON.parse(r);
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);
        if (parsed.length === 0) continue;

        const lastReadTs = await redisClient.get(
          `chat:${room}:last_read:${currentUserId}`
        );
        let unread = 0;
        if (!lastReadTs) {
          for (const m of parsed) if (m.senderId === other) unread++;
        } else {
          const lr = new Date(lastReadTs).getTime();
          for (const m of parsed) {
            try {
              const mt = new Date(m.timestamp).getTime();
              if (m.senderId === other && mt > lr) unread++;
            } catch (e) {}
          }
        }
        if (unread > 0 && unreadCounts[other] === undefined) unreadCounts[other] = unread;
      } catch (e) {
        // console.error("Error processing unread key:", e);
      }
    }

    res.json({
      unreadCounts,
      lastMessages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // console.error("Unexpected error in /api/unread-count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/mark-as-read", async (req, res) => {
  try {
    const token = extractTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: "Токен не предоставлен" });

    let decoded;
    try {
      decoded = verifyJwt(token).decoded;
    } catch (e) {
      // console.error("JWT verification error in /api/mark-as-read:", e.message);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const currentUserId = String(decoded.user_id || decoded.userId || decoded.sub);
    const { targetUserId } = req.body;
    if (!targetUserId)
      return res.status(400).json({ error: "targetUserId обязателен" });

    const roomId = getRoomId(currentUserId, String(targetUserId));
    const lastReadKey = `chat:${roomId}:last_read:${currentUserId}`;
    await redisClient.set(lastReadKey, new Date().toISOString());

    // Очистка персистентного счётчика unread для этой пары
    const unreadKey = `chat:unread_count:${currentUserId}:${targetUserId}`;
    await redisClient.del(unreadKey).catch((e) => {
      // console.error("Failed to del unreadKey in mark-as-read API:", e);
    });

    res.json({ success: true, roomId, timestamp: new Date().toISOString() });
  } catch (error) {
    // console.error("mark-as-read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

process.on("SIGTERM", async () => {
  // console.log("Received SIGTERM, shutting down gracefully");
  try {
    await redisClient.quit();
  } catch (e) {}
  server.close(() => {
    process.exit(0);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  // console.log(`Chat server running on port ${PORT}`);
  // console.log("Using secrets:");
  // console.log(" - JWT_SECRET set:", !!JWT_SECRET);
  // console.log(" - RAILS_SECRET_KEY_BASE set:", !!RAILS_SECRET_KEY_BASE);
});