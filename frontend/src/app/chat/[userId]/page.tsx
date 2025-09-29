"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AxiosError } from "axios";
import ChatWindow from "@/components/Chat/ChatWindow";
import { usersAPI } from "@/lib/api";
import { User, UserProfile } from "@/lib/api";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";
import { useCurrentUserId, useCurrentUser } from "@/hooks/auth/useAuth";

export default function ChatPage() {
  const params = useParams();
  const targetUserId = params.userId as string;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Используем хук для непрочитанных сообщений
  const { markAsRead, resetUnreadCount, getUnreadCount } = useUnreadMessages();
  const currentUserId = useCurrentUserId();
  const { data: currentUserFromHook } = useCurrentUser();

  // Сбрасываем счетчик непрочитанных при открытии чата
  useEffect(() => {
    if (targetUserId) {
      // Отмечаем сообщения как прочитанные при открытии чата
      markAsRead(targetUserId);
      // Сбрасываем счетчик непрочитанных
      resetUnreadCount(targetUserId);
    }
  }, [targetUserId, markAsRead, resetUnreadCount]);

  // Получаем количество непрочитанных сообщений для этого чата
  const unreadCount = getUnreadCount(targetUserId);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setError(null);
        setLoading(true);

        console.log("Loading user with ID:", targetUserId);
        console.log("Unread messages count:", unreadCount);

        // Получаем токен аутентификации
        const token = localStorage.getItem("authToken");
        if (!token) {
          throw new Error("Токен аутентификации не найден");
        }

        // Пытаемся использовать данные из хука, если они доступны
        if (currentUserFromHook) {
          setCurrentUser(currentUserFromHook);
        } else {
          // Альтернативный метод: получаем ID из localStorage
          const currentUserId = localStorage.getItem("currentUserId");
          if (!currentUserId) {
            throw new Error(
              "ID текущего пользователя не найден в localStorage"
            );
          }
          const currentUserData = await usersAPI.getUser(currentUserId);
          setCurrentUser(currentUserData);
        }

        // Получаем целевого пользователя
        const targetUserData = await usersAPI.getUser(targetUserId);

        console.log("Current user:", currentUserFromHook || currentUser);
        console.log("Target user:", targetUserData);

        setTargetUser(targetUserData);
      } catch (error: unknown) {
        console.error("Error loading users:", error);

        if (error instanceof AxiosError) {
          // Детализированная обработка Axios ошибок с проверкой на undefined
          const errorDetails = {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          };
          console.error("Axios error details:", errorDetails);

          // Безопасная проверка status с использованием опциональной цепочки
          const status = error.response?.status;

          if (status === 401) {
            setError("Ошибка аутентификации. Пожалуйста, войдите снова.");
          } else if (status === 404) {
            setError("Пользователь не найден.");
          } else if (status && status >= 500) {
            setError("Ошибка сервера. Попробуйте позже.");
          } else {
            setError("Произошла ошибка при загрузке данных.");
          }
        } else if (error instanceof Error) {
          // Обработка обычных JavaScript ошибок
          console.error("Error message:", error.message);
          setError(error.message || "Произошла неизвестная ошибка.");
        } else {
          console.error("Unknown error type:", error);
          setError("Произошла неизвестная ошибка.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (targetUserId && targetUserId !== "undefined") {
      loadUsers();
    } else {
      setError("ID пользователя не указан");
      setLoading(false);
    }
  }, [targetUserId, currentUserFromHook]);

  // Функция для повторной попытки загрузки
  const retryLoading = () => {
    setError(null);
    setLoading(true);
    // Перезагружаем данные через небольшой промежуток времени
    setTimeout(() => {
      if (targetUserId) {
        // Пересоздаем функцию loadUsers внутри setTimeout
        const loadUsers = async () => {
          try {
            setError(null);
            setLoading(true);

            const token = localStorage.getItem("authToken");
            if (!token) {
              throw new Error("Токен аутентификации не найден");
            }

            let currentUserData;
            try {
              // Пытаемся использовать данные из хука
              if (currentUserFromHook) {
                currentUserData = currentUserFromHook;
              } else {
                const currentUserId = localStorage.getItem("currentUserId");
                if (!currentUserId) {
                  throw new Error("ID текущего пользователя не найден");
                }
                currentUserData = await usersAPI.getUser(currentUserId);
              }
            } catch (meError) {
              console.error("Error loading current user:", meError);
              throw new Error(
                "Не удалось загрузить данные текущего пользователя"
              );
            }

            const targetUserData = await usersAPI.getUser(targetUserId);

            setCurrentUser(currentUserData);
            setTargetUser(targetUserData);
          } catch (error: unknown) {
            console.error("Error loading users on retry:", error);

            if (error instanceof AxiosError) {
              const status = error.response?.status;

              if (status === 401) {
                setError("Ошибка аутентификации. Пожалуйста, войдите снова.");
              } else if (status === 404) {
                setError("Пользователь не найден.");
              } else if (status && status >= 500) {
                setError("Ошибка сервера. Попробуйте позже.");
              } else {
                setError("Произошла ошибка при загрузке данных.");
              }
            } else if (error instanceof Error) {
              setError(error.message || "Произошла неизвестная ошибка.");
            } else {
              setError("Произошла неизвестная ошибка.");
            }
          } finally {
            setLoading(false);
          }
        };

        loadUsers();
      }
    }, 1000);
  };

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
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

  // Показываем ошибку
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ошибка загрузки
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={retryLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Проверяем, что данные загружены
  if (!currentUser || !targetUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❓</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Данные не найдены
          </h3>
          <p className="text-gray-600 mb-4">
            Не удалось загрузить данные пользователей
          </p>
          <button
            onClick={retryLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Рендерим окно чата
  return (
    <div className="h-screen flex flex-col">
      <ChatWindow
        currentUser={currentUser}
        targetUser={targetUser}
        unreadCount={unreadCount}
      />
    </div>
  );
}
