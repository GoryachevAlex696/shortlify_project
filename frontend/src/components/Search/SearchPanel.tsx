'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, FileText, X } from 'lucide-react';
import { usersAPI, postsAPI } from '@/lib/api';

interface SearchResult {
  id: string;
  type: 'user' | 'post';
  title: string;
  subtitle?: string;
  image?: string;
  raw?: any;
}

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'http://localhost:3000';

// Функция для преобразования относительного пути в абсолютный URL
const getAbsoluteImageUrl = (imagePath?: string): string | undefined => {
  if (!imagePath) return undefined;
  
  // Если путь уже абсолютный (начинается с http), возвращаем как есть
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Если путь относительный, добавляем базовый URL
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${IMAGE_BASE_URL}${normalizedPath}`;
};

export function SearchPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [searchType, setSearchType] = useState<'users' | 'posts'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Закрываем панель по Escape + фокусируем input при открытии
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Закрываем по клику вне панели
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Обработчик клика по результату
  const handleResultClick = (result: SearchResult) => {
    onClose(); // Закрываем панель поиска
    
    if (result.type === 'user') {
      // Переход на страницу пользователя
      const username = result.raw?.username || result.title;
      router.push(`/profile/${username}`);
    } else if (result.type === 'post') {
      // Переход к посту на ленте с фокусом на этот пост
      const postId = result.raw?.id || result.id;
      
      // Если мы уже на странице постов, просто скроллим к посту
      if (window.location.pathname === '/posts') {
        // Создаем кастомное событие для скролла к посту
        window.dispatchEvent(new CustomEvent('scrollToPost', { detail: { postId } }));
      } else {
        // Если не на странице постов, переходим на ленту с параметром
        router.push(`/posts?highlight=${postId}`);
      }
    }
  };

  // Основной эффект поиска с дебаунсом и отменой предыдущего запроса
  useEffect(() => {
    // Очистка предыдущего debounce
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Если панель закрыта — сбрасываем состояние
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Если query пуст — очищаем результаты
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Запускаем debounce
    debounceRef.current = window.setTimeout(async () => {
      // отменяем предыдущий fetch, если был
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }

      const ac = new AbortController();
      activeRequestRef.current = ac;

      setIsLoading(true);
      try {
        const q = searchQuery.trim();

        if (searchType === 'users') {
          // Вызов реального API для поиска пользователей
          const users = await usersAPI.searchUsers(q);
          if (ac.signal.aborted) return;
          const mapped: SearchResult[] = users.map(u => ({
            id: String(u.id),
            type: 'user',
            title: u.username,
            subtitle: u.name,
            image: getAbsoluteImageUrl(u.avatar_url),
            raw: u
          }));
          setResults(mapped);
        } else {
          // Для постов – получаем ленту и фильтруем локально
          const posts = await postsAPI.getFeedPosts();
          if (ac.signal.aborted) return;
          const qLower = q.toLowerCase();
          const filtered = posts.filter((p: any) => {
            const text = (p.text || '').toString().toLowerCase();
            const author = (p.user?.username || p.user?.name || '').toString().toLowerCase();
            return text.includes(qLower) || author.includes(qLower);
          });
          const mapped: SearchResult[] = filtered.map((p: any) => ({
            id: String(p.id),
            type: 'post',
            title: p.text?.slice(0, 60) || 'Без текста',
            subtitle: `by ${p.user?.username ?? 'unknown'}`,
            image: getAbsoluteImageUrl(p.image_url),
            raw: p
          }));
          setResults(mapped);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
        activeRequestRef.current = null;
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    };
  }, [searchQuery, searchType, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/30 to-black/30 z-50 lg:bg-opacity-0 transition-all duration-300 ease-in-out" />

      {/* Panel */}
      <div
        id="search-panel"
        ref={panelRef}
        className="fixed top-0 left-80 h-screen bg-white border-r border-gray-200 z-50 w-96 shadow-xl animate-in slide-in-from-left duration-300"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Поиск</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Закрыть поиск"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setSearchType('users')}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                searchType === 'users'
                  ? 'text-black border-b-2 border-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4 inline-block mr-2" />
              Пользователи
            </button>
            <button
              type="button"
              onClick={() => setSearchType('posts')}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                searchType === 'posts'
                  ? 'text-black border-b-2 border-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 inline-block mr-2" />
              Посты
            </button>
          </div>

          {/* Search input */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Поиск ${searchType === 'users' ? 'пользователей...' : 'постов...'}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-500 mt-2">Поиск...</p>
              </div>
            ) : searchQuery.trim() ? (
              results.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-center space-x-3">
                        {result.image ? (
                          <img
                            src={getAbsoluteImageUrl(result.image)}
                            alt={result.title}
                            className="w-10 h-10 rounded-full object-cover bg-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {result.type === 'user' ? (
                              <User className="w-5 h-5 text-gray-400" />
                            ) : (
                              <FileText className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-gray-500 text-xs truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.type === 'user' ? (
                          <User className="w-4 h-4 text-gray-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Ничего не найдено</p>
                  <p className="text-gray-400 text-sm mt-1">Попробуйте изменить запрос</p>
                </div>
              )
            ) : (
              <div className="p-8 text-center">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchType === 'users' 
                    ? 'Ищите пользователей по имени или username' 
                    : 'Ищите посты по содержанию или автору'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}