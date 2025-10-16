// useUnreadMessages.ts
import { useState, useEffect, useCallback, useRef } from "react";

export interface UnreadMessageData {
  userId: string;
  count: number;
  lastMessage?: string;
  timestamp?: string;
}

const DEFAULT_TOKEN_WAIT_MS = 2000; // максимальное время ожидания токена
const DEFAULT_TOKEN_POLL_INTERVAL_MS = 200; // интервал опроса token в ms

async function waitForToken(
  maxWaitMs = DEFAULT_TOKEN_WAIT_MS,
  intervalMs = DEFAULT_TOKEN_POLL_INTERVAL_MS
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const token = localStorage.getItem("authToken");
    if (token && token.trim() !== "") {
      return token;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
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
    async (opts?: { background?: boolean; tokenWaitMs?: number }) => {
      const background = opts?.background !== undefined ? opts.background : true;
      const tokenWaitMs = opts?.tokenWaitMs ?? DEFAULT_TOKEN_WAIT_MS;

      // Если уже выполняется запрос — пропускаем
      if (inFlightRef.current) {
        console.debug("fetchUnreadData skipped: request already in flight");
        return;
      }

      setError(null);

      // Попытаемся дождаться токена (в dev/при инициализации токен может появиться чуть позже)
      const token = await waitForToken(tokenWaitMs);

      if (!token) {
        console.debug("fetchUnreadData: no auth token available after wait — skipping fetch");
        return;
      }

      inFlightRef.current = true;

      if (background) {
        setLoadingRefresh(true);
      } else {
        setLoadingInitial(true);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        console.log("fetchUnreadData: requesting unread-count (background:)", background);

        const chatServerUrl =
          process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:3002";
        const apiUrl = `${chatServerUrl}/api/unread-count`;

        console.debug("fetchUnreadData: API URL:", apiUrl);
        console.debug("fetchUnreadData: using Authorization Bearer token (masked)");

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        console.log("fetchUnreadData: response status:", response.status);

        if (!response.ok) {
          // специальная обработка 401
          if (response.status === 401) {
            console.warn("fetchUnreadData: unauthorized (401) — token may be invalid");
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("fetchUnreadData: received data:", data);

        // Заменяем локальные данные authoritative данными с сервера
        if (data && typeof data === "object") {
          if (data.unreadCounts) {
            setUnreadCounts(data.unreadCounts);
            console.debug("fetchUnreadData: set unreadCounts (replace):", data.unreadCounts);
          } else {
            setUnreadCounts({});
          }

          if (data.lastMessages) {
            setLastMessages(data.lastMessages);
            console.debug("fetchUnreadData: set lastMessages (replace):", data.lastMessages);
          } else {
            setLastMessages({});
          }
        } else {
          // некорректный ответ — очищаем
          setUnreadCounts({});
          setLastMessages({});
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.warn("fetchUnreadData: request aborted (timeout)");
          setError("Timeout while fetching unread counts");
        } else {
          console.error("fetchUnreadData error:", err);
          setError(err?.message || "Ошибка загрузки непрочитанных");
        }
      } finally {
        clearTimeout(timeout);
        inFlightRef.current = false;
        if (background) {
          setLoadingRefresh(false);
        } else {
          setLoadingInitial(false);
        }
        console.debug("fetchUnreadData finished", { background });
      }
    },
    []
  );

  // При монтировании делаем неблокирующий background-запрос
  useEffect(() => {
    // background fetch — не ждём результат
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
    console.log("clearAllUnreadCounts: clearing all unread counts");
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
