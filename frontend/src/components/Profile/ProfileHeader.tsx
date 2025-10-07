'use client';

import { User, Settings, Edit, LogOut, Trash2, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getImageWithAuth } from '@/lib/api';

interface ProfileHeaderProps {
  profileData: {
    username: string;
    name: string;
    isPrivate?: boolean;
    avatarUrl?: string;
    is_following?: boolean; 
    followers_count?: number; 
  };
  isOwnProfile: boolean;
  onEditProfile: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onFollow: () => void;
  onUnfollow: () => void;
  isFollowLoading?: boolean;
}

export function ProfileHeader({ 
  profileData, 
  isOwnProfile, 
  onEditProfile, 
  onLogout, 
  onDeleteAccount,
  onFollow,
  onUnfollow,
  isFollowLoading = false
}: ProfileHeaderProps) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const settingsRef = useRef<HTMLDivElement>(null);

  // Обработчик клика вне выпадающего меню
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    let cancelled = false;
    let currentObjectUrl: string | null = null;

    const revokeIfBlob = (url?: string | null) => {
      if (url && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      }
    };

    const loadImage = async () => {
      if (!profileData.avatarUrl) {
        if (!cancelled) {
          setIsLoading(false);
          setImageUrl(null);
          setImageError(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setImageError(false);

        // Очистка таймстампов/параметров (если нужно)
        let cleanAvatarUrl = profileData.avatarUrl;
        if (cleanAvatarUrl.includes('?t=')) {
          cleanAvatarUrl = cleanAvatarUrl.split('?t=')[0];
        }

        console.log('Loading avatar (clean):', cleanAvatarUrl);

        // getImageWithAuth может вернуть:
        // - blob:<...> (уже готовый object URL),
        // - data:<...> (data URL),
        // - http(s) URL (в этом случае мы должны fetch + createObjectURL),
        // - или бросить исключение.
        const maybeUrl = await getImageWithAuth(cleanAvatarUrl);

        if (cancelled) {
          // если компонент размонтирован, ничего не делаем
          revokeIfBlob(maybeUrl);
          return;
        }

        // Если getImageWithAuth сам вернул blob: или data:, используем сразу
        if (typeof maybeUrl === 'string' && (maybeUrl.startsWith('blob:') || maybeUrl.startsWith('data:'))) {
          // revoke старый objectURL и назначить новый
          revokeIfBlob(imageUrl);
          currentObjectUrl = maybeUrl;
          setImageUrl(maybeUrl);
          setImageError(false);
          return;
        }

        // Если вернулась http(s) ссылка — делаем fetch с credentials (вдруг защищено cookie)
        if (typeof maybeUrl === 'string' && (maybeUrl.startsWith('http://') || maybeUrl.startsWith('https://'))) {
          try {
            const resp = await fetch(maybeUrl, {
              credentials: 'include', // если аутентификация по cookie
              // если у вас токенный механизм (Bearer), то getImageWithAuth мог вернуть URL,
              // но в этом случае fetch не поможет — лучше вернуть blob из getImageWithAuth.
            });

            if (!resp.ok) {
              throw new Error(`fetch returned ${resp.status}`);
            }

            const blob = await resp.blob();
            // revoke предыдущий blob, если был
            revokeIfBlob(imageUrl);

            currentObjectUrl = URL.createObjectURL(blob);
            if (!cancelled) {
              setImageUrl(currentObjectUrl);
              setImageError(false);
            } else {
              // сразу освобождаем если уже отменено
              URL.revokeObjectURL(currentObjectUrl);
            }
            return;
          } catch (fetchErr) {
            console.error('fetch of http(s) url failed:', fetchErr, 'url:', maybeUrl);
            // и fallthrough к попытке прямого fetch от исходного profileData.avatarUrl ниже
          }
        }

        // Если getImageWithAuth вернул что-то неожиданное или упал, делаем fallback: пытаемся fetch по исходной ссылке
        try {
          const fallbackUrl = profileData.avatarUrl.split('?t=')[0];
          const resp2 = await fetch(fallbackUrl, { credentials: 'include' });
          if (resp2.ok) {
            const blob2 = await resp2.blob();
            revokeIfBlob(imageUrl);
            currentObjectUrl = URL.createObjectURL(blob2);
            if (!cancelled) {
              setImageUrl(currentObjectUrl);
              setImageError(false);
              return;
            } else {
              URL.revokeObjectURL(currentObjectUrl);
            }
          } else {
            throw new Error(`fallback fetch returned ${resp2.status}`);
          }
        } catch (fallbackErr) {
          console.error('Fallback fetch failed:', fallbackErr);
          if (!cancelled) {
            setImageError(true);
            setImageUrl(null);
          }
        }
      } catch (err) {
        console.error('Failed to load avatar via getImageWithAuth:', err);
        if (!cancelled) {
          setImageError(true);
          setImageUrl(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadImage();

    // cleanup
    return () => {
      cancelled = true;
      if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl); } catch (e) { }
      }
    };
  }, [profileData.avatarUrl]);


  const handleSettingsClick = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleLogoutClick = () => {
    onLogout();
    setIsSettingsOpen(false);
  };

  const handleDeleteAccountClick = () => {
    onDeleteAccount();
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex items-center gap-8 py-6">
      {/* Аватар */}
      <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="animate-pulse bg-gray-300 w-12 h-12 rounded-full" />
          </div>
        ) : imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={profileData.username}
            className="w-full h-full object-cover"
            onError={() => {
              console.error('Image failed to load in img tag:', imageUrl);
              setImageError(true);
              if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
              }
            }}
            onLoad={() => {
              console.log('Image loaded successfully in img tag');
              setImageError(false);
            }}
          />
        ) : (
          <User className="w-12 h-12 text-gray-400" />
        )}
      </div>

      {/* Информация и кнопки */}
      <div className="flex-1">
        {/* Первая строка: Name и кнопки действий */}
        <div className="flex items-center justify-between mb-2">
          {/* Имя и приватность */}
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-2xl">{profileData.name}</h2>
            {profileData.isPrivate && (
              <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">🔒</span>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2">
            {/* Кнопки для своего профиля */}
            {isOwnProfile && (
              <>
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={handleSettingsClick}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Настройки</span>
                  </button>

                  {isSettingsOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]">
                      <button
                        onClick={handleLogoutClick}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Выйти</span>
                      </button>
                      <button
                        onClick={handleDeleteAccountClick}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Удалить аккаунт</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={onEditProfile}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Редактировать</span>
                </button>
              </>
            )}

            {/* Кнопки для других пользователей */}
            {!isOwnProfile && (
              <button
                onClick={profileData.is_following ? onUnfollow : onFollow}
                disabled={isFollowLoading}
                className={`px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center ${
                  profileData.is_following
                    ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                {isFollowLoading && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {profileData.is_following ? "Отписаться" : "Подписаться"}
              </button>
            )}
          </div>
        </div>

        {/* Вторая строка: Username */}
        <h1 className="text-lg font-light text-gray-600">@{profileData.username}</h1>
      </div>
    </div>
  );
}