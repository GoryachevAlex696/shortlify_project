'use client';

import { Post } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { useImageWithAuth } from '@/hooks/useImageWithAuth';
import { MoreHorizontal, Edit, Trash2, ImageIcon } from 'lucide-react';
import Link from 'next/link';

interface PostCardProps {
  post: Post;
  onEdit?: (post: Post) => void;
  onDelete?: (postId: string) => void;
  currentUserId?: string | null;
  id?: string;
}

export function PostCard({ post, onEdit, onDelete, currentUserId, id }: PostCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { blobUrl, loading: imageLoading, error: imageError } = useImageWithAuth(post.image_url);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Функция для преобразования относительного URL в абсолютный
  const getAbsoluteImageUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    if (url.startsWith('http')) return url;
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 
                   'http://localhost:3000';
    
    return `${baseUrl}${url}`;
  };

  const handleEdit = () => {
    setIsMenuOpen(false);
    onEdit?.(post);
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    if (confirm('Вы уверены, что хотите удалить этот пост?')) {
      onDelete?.(post.id);
    }
  };

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleAvatarError = () => {
    console.error('Failed to load avatar:', post.user?.avatar_url);
    setAvatarError(true);
  };

  // Проверяем, автор ли текущий пользователь поста
  const isCurrentUserAuthor = currentUserId && String(post.user?.id) === currentUserId;

  const author = post.user || {
    name: 'Неизвестный автор',
    username: 'unknown',
    avatar_url: undefined
  };

  const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23e5e7eb"/><text x="20" y="26" text-anchor="middle" fill="%236b7280" font-size="16">👤</text></svg>`;

  const avatarSrc = avatarError || !author.avatar_url ? defaultAvatar : getAbsoluteImageUrl(author.avatar_url);

  return (
    <div id={id} className="bg-white rounded-xl p-5 mb-4 shadow-card border border-gray-100">
      {/* Header with author info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <Link 
            href={`/profile/${author.username}`}
            className="hover:opacity-80 transition-opacity"
          >
            <img
              src={avatarSrc}
              alt={author.username}
              className="w-12 h-12 rounded-full object-cover bg-gray-100 border border-gray-200"
              onError={handleAvatarError}
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link 
              href={`/profile/${author.username}`}
              className="hover:opacity-80 transition-opacity"
            >
              <h3 className="font-semibold text-gray-900 text-base mb-1">{author.name}</h3>
            </Link>
            {author.name !== 'Неизвестный автор' && (
              <p className="text-xs text-gray-500">@{author.username}</p>
            )}
          </div>
        </div>

        {/* Кнопка меню - только для автора */}
        {isCurrentUserAuthor && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMenuToggle}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {/* Выпадающее меню */}
            {isMenuOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-10 min-w-[120px]">
                <button
                  onClick={handleEdit}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Редактировать</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post content */}
      <div className="mb-4">
        <p className="text-gray-800 whitespace-pre-line text-base leading-relaxed">
          {post.text}
        </p>
      </div>

      {/* Post image */}
      {post.image_url && (
        <div className="mb-4">
          {imageLoading ? (
            <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Загрузка изображения...</p>
              </div>
            </div>
          ) : blobUrl ? (
            <div className="flex justify-center">
              <img
                src={blobUrl}
                alt="Изображение поста"
                className="max-w-full max-h-96 object-contain rounded-lg"
                style={{
                  width: 'auto',
                  height: 'auto'
                }}
                onLoad={(e) => {
                  // Автоматическая подстройка размера
                  const img = e.target as HTMLImageElement;
                  if (img.naturalWidth > img.naturalHeight) {
                    // Горизонтальное изображение
                    img.classList.add('max-w-full');
                    img.classList.remove('max-h-96');
                  } else {
                    // Вертикальное изображение
                    img.classList.add('max-h-96');
                    img.classList.remove('max-w-full');
                  }
                }}
              />
            </div>
          ) : (
            <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Не удалось загрузить изображение</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}