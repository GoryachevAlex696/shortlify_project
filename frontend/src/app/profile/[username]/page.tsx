"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usersAPI,
  postsAPI,
  UserProfile,
  Post,
  authAPI,
  FollowInfo,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/auth/useAuth";
import { PostsGrid } from "@/components/Profile/PostsGrid";
import { ProfileHeader } from "@/components/Profile/ProfileHeader";
import { useRef } from "react";
import {
  Settings,
  Edit,
  Loader2,
  LogOut,
  Trash2,
  User,
  ImageIcon,
  X,
} from "lucide-react";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const username = params.username as string;
  const { data: currentUser, refetch: refetchCurrentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("posts");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const editModalRef = useRef<HTMLDivElement>(null);

  // Состояния для модальных окон подписчиков и подписок
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [isFollowingModalOpen, setIsFollowingModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"followers" | "following">(
    "followers"
  );

  // обработчик перехода на профиль
  const handleUserClick = (username: string) => {
    // Закрываем модалку
    handleCloseModal();
    // Переходим на профиль пользователя
    router.push(`/profile/${username}`);
  };

  // обработчик клика по overlay
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Закрываем только если кликнули именно на overlay (не на содержимое модалки)
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  // Запрос данных профиля
  const {
    data: profileData,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["userProfile", username],
    queryFn: async () => {
      const users = await usersAPI.searchUsers(username);
      const userFromSearch = users.find((u) => u.username === username);
      if (!userFromSearch) throw new Error("Пользователь не найден");

      const fetched = await usersAPI.getUser(userFromSearch.id);
      const cached = queryClient.getQueryData<UserProfile>([
        "userProfile",
        username,
      ]) as Partial<UserProfile> | undefined;

      const merged: UserProfile = {
        ...fetched,
        is_following:
          typeof (fetched as any).is_following === "boolean"
            ? (fetched as any).is_following
            : cached?.is_following ?? false,
        followers_count:
          typeof (fetched as any).followers_count === "number"
            ? (fetched as any).followers_count
            : cached?.followers_count ?? fetched.followers_count ?? 0,
      };

      return merged;
    },
    enabled: !!username,
  });

  // Запрос постов пользователя
  const { data: userPosts, isLoading: isPostsLoading } = useQuery({
    queryKey: ["userPosts", profileData?.id],
    queryFn: async () => {
      if (!profileData?.id) return [];
      return await postsAPI.getUserPosts(profileData.id);
    },
    enabled: !!profileData?.id && activeTab === "posts",
  });

  // Запрос подписчиков
  const { data: followers = [], isLoading: isFollowersLoading } = useQuery({
    queryKey: ["followers", profileData?.id],
    queryFn: async () => {
      if (!profileData?.id) return [];
      return await usersAPI.getFollowers(profileData.id);
    },
    enabled: !!profileData?.id && isFollowersModalOpen,
  });

  // Запрос подписок
  const { data: following = [], isLoading: isFollowingLoading } = useQuery({
    queryKey: ["following", profileData?.id],
    queryFn: async () => {
      if (!profileData?.id) return [];
      return await usersAPI.getFollowing(profileData.id);
    },
    enabled: !!profileData?.id && isFollowingModalOpen,
  });

  // Мутация для выхода
  const logoutMutation = useMutation({
    mutationFn: authAPI.logout,
    onSuccess: () => {
      router.push("/login");
    },
  });

  // Мутация для удаления аккаунта
  const deleteAccountMutation = useMutation({
  mutationFn: async () => {
    console.log("Deleting account ID:", profileData!.id);
    console.log("Current user ID:", currentUser?.id);
    
    // Проверяем токен
    const token = localStorage.getItem('authToken');
    console.log("Auth token exists:", !!token);
    
    return await usersAPI.removeUser(profileData!.id);
  },
  onSuccess: () => {
    console.log("Account deleted successfully");
    router.push("/");
  },
  onError: (error: any) => {
    console.error("Delete account error details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    alert(`Ошибка при удалении аккаунта: ${error.response?.data?.message || error.message}`);
  },
});

  // Мутация для обновления аватара
  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarFile: File) => {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      try {
        const result = await usersAPI.updateUser(profileData!.id, formData);
        return result;
      } catch (error) {
        console.error("Avatar upload failed:", error);
        throw error;
      }
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });

      setIsEditModalOpen(false);
      setSelectedAvatar(null);
      setAvatarPreview("");

      setTimeout(() => {
        const cachedData = queryClient.getQueryData<UserProfile>([
          "userProfile",
          username,
        ]);
        if (!cachedData?.avatar_url) {
          window.location.reload();
        }
      }, 1000);
    },
    onError: (error) => {
      console.error("Avatar update error:", error);
      alert("Ошибка при обновлении аватара");
    },
  });

  // Мутация для подписки
  const followMutation = useMutation({
    mutationFn: () => usersAPI.followUser(profileData!.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["userProfile", username] });
      const previousProfile = queryClient.getQueryData<UserProfile>([
        "userProfile",
        username,
      ]);

      if (previousProfile) {
        queryClient.setQueryData(["userProfile", username], {
          ...previousProfile,
          is_following: true,
          followers_count: previousProfile.followers_count + 1,
        });
      }

      return { previousProfile };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          ["userProfile", username],
          context.previousProfile
        );
      }
    },
  });

  // Мутация для отписки
  const unfollowMutation = useMutation({
    mutationFn: () => usersAPI.unfollowUser(profileData!.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["userProfile", username] });
      const previousProfile = queryClient.getQueryData<UserProfile>([
        "userProfile",
        username,
      ]);

      if (previousProfile) {
        queryClient.setQueryData(["userProfile", username], {
          ...previousProfile,
          is_following: false,
          followers_count: Math.max(0, previousProfile.followers_count - 1),
        });
      }

      return { previousProfile };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          ["userProfile", username],
          context.previousProfile
        );
      }
    },
  });
  ////////////////////////////////////////////////////////////////////////
  const deletePostMutation = useMutation({
    mutationFn: postsAPI.deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["userPosts", profileData?.id],
      });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { text: string; image?: File | null };
    }) => postsAPI.updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["userPosts", profileData?.id],
      });
    },
  });

  // объявляем обработчики, которые используют мутации выше
  const handleEditPost = async (
    postId: string,
    data: { text: string; image?: File | null }
  ) => {
    console.log("Editing post:", postId, data);
    try {
      await updatePostMutation.mutateAsync({ id: postId, data });
      console.log("Post edited successfully");
    } catch (error) {
      console.error("Error editing post:", error);
      throw error;
    }
  };

  const handleDeletePost = (postId: string) => {
    console.log("Deleting post:", postId);
    deletePostMutation.mutate(postId);
  };
  ///////////////////////////////////////////////////
  const isFollowLoading =
    followMutation.isPending || unfollowMutation.isPending;
  const isOwnProfile = currentUser?.username === username;

  // Обработчики для модальных окон
  const handleOpenFollowers = () => {
    setModalType("followers");
    setIsFollowersModalOpen(true);
  };

  const handleOpenFollowing = () => {
    setModalType("following");
    setIsFollowingModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsFollowersModalOpen(false);
    setIsFollowingModalOpen(false);
  };

  useEffect(() => {
    if (profileData) {
      console.log("Profile data updated:", {
        id: profileData.id,
        username: profileData.username,
        is_following: profileData.is_following,
        followers_count: profileData.followers_count,
      });
    }
  }, [profileData]);

  useEffect(() => {
    if (currentUser) {
      console.log("Current user updated:", {
        id: currentUser.id,
        username: currentUser.username,
      });
    }
  }, [currentUser]);

  // Обработчик клика вне модального окна редактирования
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editModalRef.current &&
        !editModalRef.current.contains(event.target as Node) &&
        isEditModalOpen
      ) {
        setIsEditModalOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditModalOpen]);

  const getAbsoluteImageUrl = (url: string | undefined): string => {
    if (!url) return "";

    // Если URL уже абсолютный (начинается с http), возвращаем как есть
    if (url.startsWith("http")) return url;

    // Для статических файлов используем базовый URL без /api/v1
    const baseUrl = "http://localhost:3000";

    return `${baseUrl}${url}`;
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await usersAPI.removeAvatar(profileData!.id);
      queryClient.invalidateQueries({ queryKey: ["userProfile", username] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });

      if (isEditModalOpen) {
        setIsEditModalOpen(false);
      }

      alert("Аватар успешно удален");
      setTimeout(() => {
        refetchProfile();
        refetchCurrentUser();
      }, 500);
    } catch (error: any) {
      console.error("Ошибка при удалении аватара:", error);
      alert(
        "Не удалось удалить аватар: " +
          (error.response?.data?.message ||
            error.response?.data?.errors ||
            error.message)
      );
    }
  };

  const handleSaveAvatar = async () => {
    if (selectedAvatar) {
      try {
        await updateAvatarMutation.mutateAsync(selectedAvatar);
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["userProfile", username],
          });
          refetchProfile();
        }, 500);
      } catch (error) {
        console.error("Failed to save avatar:", error);
      }
    }
  };

  const handleFollow = async () => {
    if (!profileData) return;

    try {
      const updatedUser = await followMutation.mutateAsync();

      // Обновляем данные из ответа сервера
      queryClient.setQueryData(["userProfile", username], updatedUser);
    } catch (error) {
      console.error("Follow error:", error);
    }
  };

  const handleUnfollow = async () => {
    if (!profileData) return;

    try {
      const updatedUser = await unfollowMutation.mutateAsync();

      // Обновляем данные из ответа сервера
      queryClient.setQueryData(["userProfile", username], updatedUser);
    } catch (error) {
      console.error("Unfollow error:", error);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleDeleteAccount = () => {
    if (
      confirm(
        "Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить."
      )
    ) {
      deleteAccountMutation.mutate();
    }
  };

  if (isProfileLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Загрузка профиля...</span>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Ошибка загрузки
          </h2>
          <p className="text-gray-600">
            Пользователь не найден или произошла ошибка
          </p>
          <Link
            href="/posts"
            className="text-blue-500 hover:text-blue-600 mt-4 inline-block"
          >
            Вернуться к ленте
          </Link>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Пользователь не найден
          </h2>
          <p className="text-gray-600">
            Пользователь с именем @{username} не существует
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Хедер профиля */}
      <ProfileHeader
        key={profileData.avatar_url}
        profileData={{
          username: profileData.username,
          name: profileData.name,
          isPrivate: false,
          avatarUrl: profileData.avatar_url
            ? `${profileData.avatar_url}?t=${Date.now()}`
            : undefined,
          is_following: profileData.is_following,
          followers_count: profileData.followers_count,
        }}
        isOwnProfile={isOwnProfile}
        onEditProfile={() => setIsEditModalOpen(true)}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        onFollow={handleFollow}
        onUnfollow={handleUnfollow}
        isFollowLoading={followMutation.isPending || unfollowMutation.isPending}
      />

      {/* Статистика */}
      <div className="flex items-center justify-around py-6 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-semibold">{userPosts?.length || 0}</div>
          <div className="text-gray-600 text-sm">Публикаций</div>
        </div>

        {/* Подписчики - кликабельные */}
        <div
          className="text-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleOpenFollowers}
        >
          <div className="text-2xl font-semibold">
            {profileData.followers_count}
          </div>
          <div className="text-gray-600 text-sm">Подписчиков</div>
        </div>

        {/* Подписки - кликабельные */}
        <div
          className="text-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleOpenFollowing}
        >
          <div className="text-2xl font-semibold">
            {profileData.following_count}
          </div>
          <div className="text-gray-600 text-sm">Подписок</div>
        </div>
      </div>

      {/* Био */}
      <div className="py-4">
        {profileData.bio && (
          <p className="text-gray-800 mt-2">{profileData.bio}</p>
        )}
        {profileData.website && (
          <a
            href={profileData.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-sm mt-1 block"
          >
            {profileData.website}
          </a>
        )}
      </div>

      {/* Контент */}
      <div className="py-6">
        {activeTab === "posts" && (
          <>
            {isPostsLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">Загрузка постов...</span>
              </div>
            ) : userPosts && userPosts.length > 0 ? (
              <>
                {console.log("User posts:", userPosts)}
                <PostsGrid
                  posts={userPosts}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                />
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {isOwnProfile
                  ? "У вас пока нет публикаций"
                  : "У пользователя пока нет публикаций"}
              </div>
            )}
          </>
        )}
        {activeTab === "saved" && (
          <div className="text-center py-12 text-gray-500">
            Сохраненные публикации
          </div>
        )}
        {activeTab === "tagged" && (
          <div className="text-center py-12 text-gray-500">
            Отмеченные публикации
          </div>
        )}
      </div>

      {/* Модальное окно редактирования аватара */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 bg-gradient-to-b from-black/30 to-black/30 z-50 flex items-center justify-center"
          onClick={(e) => {
            // Закрытие по клику на overlay
            if (e.target === e.currentTarget) {
              setIsEditModalOpen(false);
            }
          }}
        >
          <div
            ref={editModalRef}
            className="bg-white rounded-lg p-6 w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Редактирование профиля</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={updateAvatarMutation.isPending}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {updateAvatarMutation.isPending && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
                  <span className="text-blue-700">Сохранение...</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Аватар</label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : profileData.avatar_url ? (
                      <img
                        src={`${profileData.avatar_url}?t=${Date.now()}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="cursor-pointer">
                      <span className="text-sm text-blue-500 hover:text-blue-600">
                        Выбрать файл
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        disabled={updateAvatarMutation.isPending}
                      />
                    </label>
                    {profileData.avatar_url && (
                      <button
                        onClick={handleRemoveAvatar}
                        className="text-sm text-red-500 hover:text-red-600 text-left"
                        disabled={updateAvatarMutation.isPending}
                      >
                        Удалить аватар
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={updateAvatarMutation.isPending}
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveAvatar}
                  disabled={!selectedAvatar || updateAvatarMutation.isPending}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
                >
                  {updateAvatarMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подписчиков/подписок */}
      {(isFollowersModalOpen || isFollowingModalOpen) && (
        <div
          className="fixed inset-0 bg-gradient-to-b from-black/30 to-black/30 z-50 flex items-center justify-center"
          onClick={handleOverlayClick}
        >
          <div
            className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {modalType === "followers" ? "Подписчики" : "Подписки"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalType === "followers" ? (
              <>
                {isFollowersLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">Загрузка...</span>
                  </div>
                ) : followers.length > 0 ? (
                  <div className="space-y-3">
                    {followers.map((user) => {
                      const userAvatarUrl = getAbsoluteImageUrl(
                        user.avatar_url
                      );
                      return (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                          onClick={() => handleUserClick(user.username)}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {userAvatarUrl ? (
                              <img
                                src={userAvatarUrl}
                                alt={user.username}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback на дефолтную аватарку при ошибке
                                  (
                                    e.target as HTMLImageElement
                                  ).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23e5e7eb"/><text x="20" y="26" text-anchor="middle" fill="%236b7280" font-size="16">👤</text></svg>`;
                                }}
                              />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-gray-500">
                              {user.name}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Нет подписчиков
                  </div>
                )}
              </>
            ) : (
              <>
                {isFollowingLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">Загрузка...</span>
                  </div>
                ) : following.length > 0 ? (
                  <div className="space-y-3">
                    {following.map((user) => {
                      const userAvatarUrl = getAbsoluteImageUrl(
                        user.avatar_url
                      );
                      return (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                          onClick={() => handleUserClick(user.username)}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {userAvatarUrl ? (
                              <img
                                src={userAvatarUrl}
                                alt={user.username}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback на дефолтную аватарку при ошибке
                                  (
                                    e.target as HTMLImageElement
                                  ).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23e5e7eb"/><text x="20" y="26" text-anchor="middle" fill="%236b7280" font-size="16">👤</text></svg>`;
                                }}
                              />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-gray-500">
                              {user.name}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Нет подписок
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
