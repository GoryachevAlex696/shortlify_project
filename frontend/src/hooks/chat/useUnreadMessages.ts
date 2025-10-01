import { useState, useEffect, useCallback, useRef } from "react";

export interface UnreadMessageData {
  userId: string;
  count: number;
  lastMessage?: string;
  timestamp?: string;
}

export const useUnreadMessages = () => {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const [loadingInitial, setLoadingInitial] = useState(false); // первоначальная загрузка
  const [loadingRefresh, setLoadingRefresh] = useState(false); // фоновые обновления (не блокируют UI)
  const [error, setError] = useState<string | null>(null);

  // ref чтобы избежать параллельных запросов
  const inFlightRef = useRef(false);

  const fetchUnreadData = useCallback(
    async (opts?: { background?: boolean }) => {
      const background = opts?.background !== undefined ? opts.background : true;

      // Если уже выполняется запрос — пропускаем 
      if (inFlightRef.current) {
        console.debug("fetchUnreadData skipped: request already in flight");
        return;
      }

      inFlightRef.current = true;
      setError(null);
      try {
        if (background) {
          setLoadingRefresh(true);
        } else {
          setLoadingInitial(true);
        }

        console.log("Запрашиваю данные о непрочитанных сообщений...", {
          background,
        });

        const chatServerUrl =
          process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:3002";
        const token = localStorage.getItem("authToken");

        if (!token) {
          console.log("❌ Токен авторизации не найден, пропускаем fetchUnreadData");
          return;
        }

        const apiUrl = `${chatServerUrl}/api/unread-count`;
        console.log("Full URL:", apiUrl);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Статус ответа:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Данные получены:", data);

        // Заменяем локальные данные authoritative данными с сервера
        if (data.unreadCounts) {
          setUnreadCounts(data.unreadCounts);
          console.log("Обновлены счетчики (replace):", data.unreadCounts);
        } else {
          // если сервер ничего не вернул — очищаем, чтобы не держать устаревшие значения
          setUnreadCounts({});
        }

        if (data.lastMessages) {
          setLastMessages(data.lastMessages);
          console.log("Обновлены последние сообщения (replace):", data.lastMessages);
        } else {
          setLastMessages({});
        }
      } catch (err: any) {
        console.error("Ошибка загрузки непрочитанных:", err);
        setError(err?.message || "Ошибка загрузки непрочитанных");
      } finally {
        inFlightRef.current = false;
        if (background) {
          setLoadingRefresh(false);
        } else {
          setLoadingInitial(false);
        }
        console.log("fetchUnreadData finished", { background });
      }
    },
    []
  );

  // При монтировании делаем неблокирующий background-запрос 
  useEffect(() => {
    fetchUnreadData({ background: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getUnreadCount = useCallback(
    (userId: string): number => {
      return unreadCounts[userId] || 0;
    },
    [unreadCounts]
  );

  const getLastMessage = useCallback(
    (userId: string): string => {
      return lastMessages[userId] || "";
    },
    [lastMessages]
  );

  const markAsRead = useCallback((userId: string) => {
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[userId];
      return newCounts;
    });
  }, []);

  const resetUnreadCount = useCallback((userId: string) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [userId]: 0,
    }));
  }, []);

  const setUnreadCount = useCallback((userId: string, count: number) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [userId]: count,
    }));
  }, []);

  const setLastMessage = useCallback((userId: string, message: string) => {
    setLastMessages((prev) => ({
      ...prev,
      [userId]: message,
    }));
  }, []);

  const updateLastMessage = useCallback((userId: string, message: string) => {
    setLastMessages((prev) => ({
      ...prev,
      [userId]: message,
    }));
  }, []);

  const incrementUnreadCount = useCallback((userId: string) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [userId]: (prev[userId] || 0) + 1,
    }));
  }, []);

  const clearAllUnreadCounts = useCallback(() => {
    console.log("Очищаю все непрочитанные сообщения");
    setUnreadCounts({});
  }, []);
  const loading = loadingInitial;

  return {
    unreadCounts,
    lastMessages,
    loading,
    loadingInitial,
    loadingRefresh,
    error,
    getUnreadCount,
    getLastMessage,
    markAsRead,
    resetUnreadCount,
    setUnreadCount,
    setLastMessage,
    updateLastMessage,
    incrementUnreadCount,
    fetchUnreadData,
    clearAllUnreadCounts,
  };
};