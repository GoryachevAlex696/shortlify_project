"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { usersAPI, getImageWithAuth } from "@/lib/api";
import { UserProfile } from "@/lib/api";
import { useCurrentUserId, useCurrentUser } from "@/hooks/auth/useAuth";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";

// компонент — аватар по умолчанию
const DefaultAvatar = ({
  className = "w-12 h-12 text-gray-400",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
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

export default function ChatListPage() {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const currentUserId = useCurrentUserId();
  const { data: currentUser } = useCurrentUser();
  const {
    unreadCounts,
    getUnreadCount,
    getLastMessage,
    setUnreadCount,
    setLastMessage,
    loading: unreadLoading,
    error: unreadError,
    updateLastMessage,
    incrementUnreadCount,
    fetchUnreadData,
  } = useUnreadMessages();

  // Префетч / кэш аватарок: userId -> url | null
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  // Чтобы не перегружать многократными fetch при быстрых сменах пользователей
  const avatarLoadingRef = useRef<Record<string, boolean>>({});

  const unreadRef = useRef<Record<string, number>>({});
  const unreadTsRef = useRef<Record<string, number>>({});
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // === ADDED: total unread (для глобального баннера) ===
  const totalUnread = Object.values(unreadCounts || {}).reduce(
    (acc, v) => acc + (typeof v === "number" ? v : Number(v || 0)),
    0
  );

  // === ADDED: refs for batching socket updates ===
  const pendingIncrementsRef = useRef<Record<string, number>>({});
  const pendingLastMsgRef = useRef<Record<string, string>>({});
  const batchTimerRef = useRef<number | null>(null);

  // --- helper: безопасное add (через setUnreadCount) ---
const addUnreadBatch = (userId: string, add: number) => {
  try {
    const cur = Number(getUnreadCount(userId) || 0);
    setUnreadCount(userId, cur + add);
  } catch (e) {
    console.error("addUnreadBatch error:", e);
  }
};

  // --- изменяем scheduleBatchFlush (использовать setUnreadCount разом) ---
  const scheduleBatchFlush = () => {
    if (batchTimerRef.current) return;
    batchTimerRef.current = window.setTimeout(() => {
      const incs = { ...pendingIncrementsRef.current };
      const lastMsgs = { ...pendingLastMsgRef.current };
      pendingIncrementsRef.current = {};
      pendingLastMsgRef.current = {};
      batchTimerRef.current = null;

      // Применяем инкременты атомарно
      Object.entries(incs).forEach(([userId, count]) => {
        try {
          const cur = Number(unreadRef.current[userId] || 0);
          const newVal = cur + Number(count || 0);
          // обновляем локальную копию и глобальную (хук)
          unreadRef.current[userId] = newVal;
          setUnreadCount(userId, newVal);
        } catch (err) {
          console.error("Batch increment error:", err);
        }
      });

      // Обновляем последние сообщения (одно присвоение)
      Object.entries(lastMsgs).forEach(([userId, msg]) => {
        try {
          setLastMessage(userId, msg);
        } catch (err) {
          console.error("Batch setLastMessage error:", err);
        }
      });
    }, 200);
  };


  // функция для загрузки пользователей (без изменений логики, немного формат)
  const loadUsers = async () => {
    try {
      setUsersError(null);
      setLoading(true);

      if (!currentUserId) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("authToken");
      if (!token) {
        setUsersError("Требуется авторизация");
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await usersAPI.searchUsers("", {
        signal: controller.signal,
      } as any);

      clearTimeout(timeoutId);

      if (!response || !Array.isArray(response)) {
        throw new Error("Некорректный ответ от сервера");
      }

      const filteredUsers = response.filter(
        (user) => user.id !== currentUserId && user.id !== undefined
      );

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error);
      setUsersError(
        error instanceof Error ? `Ошибка: ${error.message}` : "Неизвестная ошибка"
      );
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = (
    avatarUrl: string | undefined | null
  ): string | null => {
    if (!avatarUrl || avatarUrl.trim() === "") {
      return null;
    }

    const cleanUrl = avatarUrl.trim();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (cleanUrl.startsWith("/rails/active_storage") || cleanUrl.includes("/rails/active_storage/blobs/")) {
      // уже относительный путь — делаем абсолютным
      return `${baseUrl}${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`;
    }

    let relativeUrl = cleanUrl;
    if (!relativeUrl.startsWith("/")) {
      relativeUrl = `/${relativeUrl}`;
    }

    const fullUrl = `${baseUrl}${relativeUrl}`;
    return fullUrl;
  };

  // Синхронизируем ref с хранилищем хука (при изменении unreadCounts)
  useEffect(() => {
    if (unreadCounts) {
      unreadRef.current = { ...unreadCounts } as Record<string, number>;
    }
  }, [unreadCounts]);

  // ----------------------------
  // Загрузка/кеширование аватарок при изменении списка пользователей
  // ----------------------------
  useEffect(() => {
    let mounted = true;
    const createdBlobUrls: string[] = [];

    const loadAvatars = async () => {
      if (!users || users.length === 0) {
        if (mounted) setAvatarMap({});
        return;
      }

      // Берём copy текущей карты (может быть устаревшей, но мы аккуратно мержим через setAvatarMap)
      const nextMap: Record<string, string | null> = { ...avatarMap };

      for (const u of users) {
        try {
          if (!u || !u.id) continue;
          const uid = String(u.id);

          // если уже загружается - пропустить
          if (avatarLoadingRef.current[uid]) continue;

          // Пропускаем загрузку только если у нас уже есть рабочая строка (URL).
          // Если там null (ошибка) — мы попытаемся снова.
          if (typeof nextMap[uid] === "string" && nextMap[uid] !== "") {
            continue;
          }

          avatarLoadingRef.current[uid] = true;

          // если аватарки вообще нет — явно пометим null
          if (!u.avatar_url) {
            nextMap[uid] = null;
            avatarLoadingRef.current[uid] = false;
            continue;
          }

          try {
            const resolved = await getImageWithAuth(u.avatar_url);

            if (!mounted) {
              // если уже размонтированы — отзовём blob, если он был создан
              if (typeof resolved === "string" && resolved.startsWith("blob:")) {
                try {
                  URL.revokeObjectURL(resolved);
                } catch {}
              }
              avatarLoadingRef.current[uid] = false;
              break;
            }

            nextMap[uid] = resolved;
            if (typeof resolved === "string" && resolved.startsWith("blob:")) {
              createdBlobUrls.push(resolved);
            }
          } catch (e) {
            console.error("Error loading avatar for", uid, e);
            // fallback: попробуем собрать относительную/полную ссылку
            const fallback = getAvatarUrl(u.avatar_url);
            nextMap[uid] = fallback ?? null;
          } finally {
            avatarLoadingRef.current[uid] = false;
          }
        } catch (outer) {
          console.error("Avatar load loop error:", outer);
        }
      }

      if (mounted) {
        // мержим изменения аккуратно
        setAvatarMap((prev) => ({ ...prev, ...nextMap }));
      } else {
        // если компонент уже размонтирован — рекупируем blob'ы
        for (const b of createdBlobUrls) {
          try {
            URL.revokeObjectURL(b);
          } catch {}
        }
      }
    };

    loadAvatars();

    return () => {
      mounted = false;
      // ревокнем blob'ы, которые создали в этом эффекте
      for (const b of createdBlobUrls) {
        try {
          URL.revokeObjectURL(b);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]); // специально — только при изменении users

  // для загрузки пользователей при монтировании
  useEffect(() => {
    if (currentUserId) {
      loadUsers();

      // задержка перед загрузкой непрочитанных
      const timer = setTimeout(() => {
        fetchUnreadData();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentUserId]);

  // WebSocket and other code unchanged...
  // (оставляю остальной код такой же как у тебя — он не затронут)

  useEffect(() => {
    if (!currentUserId) return;

    const chatServerUrl =
      process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:3002";

    const newSocket = io(chatServerUrl, {
      auth: {
        token: localStorage.getItem("authToken"),
      },
    });

    newSocket.on("connect", () => {
      setSocket(newSocket);
    });    

    newSocket.on(
      "new_unread_message",
      (data: { senderId: string; message: string; messageId?: string; timestamp?: string }) => {
        if (!data.senderId) return;
        if (data.senderId === currentUserId) return;

        const uid = String(data.senderId);
        // если сервер даёт messageId — используй его, иначе fallback на uid+timestamp
        const msgId = data.messageId ?? `${uid}:${data.timestamp ?? Date.now()}`;

        // дедуп — если уже обработано, игнорируем
        if (processedMessageIdsRef.current.has(msgId)) {
          console.debug("Duplicate new_unread_message ignored", msgId);
          return;
        }
        // помечаем как обработанное (TTL через минуту)
        processedMessageIdsRef.current.add(msgId);
        setTimeout(() => processedMessageIdsRef.current.delete(msgId), 60_000);

        try {
          const cur = Number(unreadRef.current[uid] || 0);
          const newVal = cur + 1;
          unreadRef.current[uid] = newVal;
          setUnreadCount(uid, newVal);
          setLastMessage(uid, data.message || "");
        } catch (err) {
          console.error("new_unread_message handler error:", err);
        }

        pendingLastMsgRef.current[uid] = data.message || "";
      }
    );

    newSocket.on(
      "chat_list_update",
      (data: {
        senderId?: string;
        userId: string;
        lastMessage?: string;
        timestamp?: string;
        unreadCount?: number;
      }) => {
        const uid = String(data.userId);
        if (data.lastMessage !== undefined) {
          setLastMessage(uid, data.lastMessage);
        }
        console.debug("socket chat_list_update incoming", { uid: data.userId, unreadCount: data.unreadCount, timestamp: data.timestamp });

        if (typeof data.unreadCount === "number") {
          const incoming = Number(data.unreadCount);
          const cur = Number(unreadRef.current[uid] || 0);

          // если есть timestamp, можно сравнить:
          if (data.timestamp) {
            const incomingTs = Date.parse(data.timestamp) || 0;
            const curTs = unreadTsRef.current[uid] || 0;
            if (incomingTs >= curTs) {
              unreadTsRef.current[uid] = incomingTs;
              const toSet = Math.max(cur, incoming);
              unreadRef.current[uid] = toSet;
              setUnreadCount(uid, toSet);
            } else {
              // опоздавшее событие — игнорируем
            }
          } else {
            // без timestamp — применяем max (не даём откатиться)
            const toSet = Math.max(cur, incoming);
            unreadRef.current[uid] = toSet;
            setUnreadCount(uid, toSet);
          }
        }
      }
    );

    newSocket.on(
      "unread_counts_updated",
      (data: { unreadCounts: Record<string, number> }) => {
        Object.entries(data.unreadCounts).forEach(([userId, count]) => {
          const uid = String(userId);
          const incoming = Number(count || 0);
          const cur = Number(unreadRef.current[uid] || 0);
          const toSet = Math.max(cur, incoming);
          unreadRef.current[uid] = toSet;
          setUnreadCount(uid, toSet);
        });
      }
    );



    newSocket.on(
      "messages_read",
      (data: { readerId: string; targetUserId: string }) => {
        setUnreadCount(data.readerId, 0);
      }
    );

    newSocket.on("disconnect", () => {
      setSocket(null);
    });

    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    return () => {
      try {
        newSocket.disconnect();
      } catch {}
    };
  }, [
    currentUserId,
    incrementUnreadCount,
    setLastMessage,
    setUnreadCount,
    fetchUnreadData,
  ]);

  // Автоматическое обновление счетчиков (каждые 30s)
  useEffect(() => {
    if (!currentUserId) return;

    const interval = setInterval(() => {
      fetchUnreadData();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUserId, fetchUnreadData]);

  useEffect(() => {
    users.forEach((user) => {
      const lastMessage = getLastMessage(user.id!);
      const unreadCount = getUnreadCount(user.id!);
      console.log(
        `👤 ${user.username} (ID: ${user.id}): "${lastMessage}" [${unreadCount} непрочитанных]`
      );
    });
  }, [getLastMessage, users, getUnreadCount]);

  const truncateMessage = (text: string, maxLength: number = 35) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Показываем skeleton только при начальной загрузке пользователей
  if (loading && users.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-4 p-4 border rounded-lg mb-3"
            >
              <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/6"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Сообщения</h1>
            <p className="text-gray-500 text-sm mt-1">
              Выберите пользователя для начала общения
            </p>
          </div>

          <div className="ml-4 text-right">
            {totalUnread > 0 ? (
              <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-3 py-1 rounded-full text-sm">
                <span className="font-medium">{totalUnread}</span>
                <span className="text-xs">непрочитанных</span>
              </div>
            ) : (
              <div className="text-xs text-gray-400">Непрочитанных: 0</div>
            )}

            {unreadLoading && (
              <div className="mt-1 text-right">
                <span className="inline-block w-4 h-4 animate-spin border-b-2 border-gray-500 rounded-full" />
              </div>
            )}
          </div>
        </div>

        {unreadError && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">⚠️ {unreadError}</p>
          </div>
        )}
      </div>

      {usersError ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-gray-500 mb-2">{usersError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Попробовать снова
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-gray-500 mb-2">Пока нет пользователей для чата</p>
          <p className="text-gray-400 text-sm">
            Найдите пользователей через поиск
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const avatarUrl = avatarMap[user.id!] ?? null;
            const unreadCount = getUnreadCount(user.id!);
            const lastMessage = getLastMessage(user.id!);

            return (
              <Link
                key={user.id}
                href={`/chat/${user.id}`}
                className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-100 shadow-sm hover:shadow-md group relative"
              >
                {unreadCount > 0 && (
                  <div className="absolute -top11 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium z-10">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}

                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-medium">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user.username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const src = (e.currentTarget.src || "") as string;
                          // Скрываем проблемное изображение
                          e.currentTarget.style.display = "none";

                          // Отзовём blob, если нужно
                          if (src && src.startsWith("blob:")) {
                            try {
                              URL.revokeObjectURL(src);
                            } catch (err) {
                              console.warn("Failed to revoke blob URL", err);
                            }
                          }

                          // Попробуем fallback (например, абсолютный/относительный URL)
                          const fallback = getAvatarUrl(user.avatar_url);
                          setAvatarMap((prev) => ({
                            ...prev,
                            [user.id!]: fallback ?? null,
                          }));
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full flex items-center justify-center ${
                        avatarUrl ? "hidden" : "flex"
                      }`}
                    >
                      <DefaultAvatar className="w-12 h-12" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="font-semibold text-gray-900 truncate">
                      {user.name || "Без имени"}
                    </p>
                    {user.is_following && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
                        Подписан
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm truncate">
                    @{user.username || "unknown"}
                  </p>
                  <p
                    className={`text-sm truncate mt-1 ${
                      unreadCount > 0
                        ? "text-black font-medium"
                        : "text-gray-400"
                    }`}
                  >
                    {unreadCount > 0
                      ? `${unreadCount} нов${
                          unreadCount === 1 ? "ое" : "ых"
                        } сообщени${unreadCount === 1 ? "е" : "й"}`
                      : lastMessage
                      ? truncateMessage(lastMessage)
                      : "Начните общение..."}
                  </p>
                </div>

                <div className="text-gray-300 group-hover:text-gray-600 transition-colors flex-shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}      
    </div>
  );
}