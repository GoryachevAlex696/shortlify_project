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
  isFollowLoading = false,
}: ProfileHeaderProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadAvatar = async () => {
      if (!profileData.avatarUrl) {
        setImageUrl(null);
        setIsLoading(false);
        setImageError(false);
        return;
      }

      try {
        setIsLoading(true);
        setImageError(false);

        const result = await getImageWithAuth(profileData.avatarUrl);

        if (cancelled) return;

        if (!result) {
          setImageUrl(null);
          setImageError(true);
        } else if (result.startsWith('blob:') || result.startsWith('data:')) {
          setImageUrl(result);
          setImageError(false);
        } else if (result.startsWith('http://') || result.startsWith('https://')) {
          // Для Rails ActiveStorage просто ставим URL в img
          setImageUrl(result);
          setImageError(false);
        } else {
          console.warn('Unexpected avatar URL:', result);
          setImageUrl(null);
          setImageError(true);
        }
      } catch (err) {
        console.error('Failed to load avatar:', err);
        setImageUrl(null);
        setImageError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [profileData.avatarUrl]);

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
            className="w-full h-full object-cover object-center"
            onError={() => setImageError(true)}
          />
        ) : (
          <User className="w-12 h-12 text-gray-400" />
        )}
      </div>

      {/* Информация и кнопки */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-2xl">{profileData.name}</h2>
            {profileData.isPrivate && (
              <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">🔒</span>
            )}
          </div>

          <div className="flex gap-2">
            {isOwnProfile && (
              <>
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Настройки</span>
                  </button>

                  {isSettingsOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-[180px]">
                      <button
                        onClick={() => { onLogout(); setIsSettingsOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Выйти</span>
                      </button>
                      <button
                        onClick={() => { onDeleteAccount(); setIsSettingsOpen(false); }}
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

            {!isOwnProfile && (
              <button
                onClick={profileData.is_following ? onUnfollow : onFollow}
                disabled={isFollowLoading}
                className={`px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center ${
                  profileData.is_following
                    ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isFollowLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {profileData.is_following ? 'Отписаться' : 'Подписаться'}
              </button>
            )}
          </div>
        </div>

        <h1 className="text-lg font-light text-gray-600">@{profileData.username}</h1>
      </div>
    </div>
  );
}
