'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  User,
  PlusSquare,
  MessageCircle,
  Heart,
  Instagram
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/auth/useAuth';
import { useCurrentUserId } from '@/hooks/auth/useAuth';
import { SearchPanel } from '../Search/SearchPanel';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentUserId = useCurrentUserId();
  const { data: user, isLoading, error } = useCurrentUser();

  // Skeleton loader
  if (!isMounted || isLoading) {
    return (
      <aside className="fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-100 w-80">
        <div className="flex flex-col h-full p-6">
          {/* Логотип скелетон */}
          <div className="px-4 py-6 mb-8">
            <div className="h-8 bg-gray-200 rounded-lg w-32"></div>
          </div>
          
          {/* Навигация скелетон */}
          <nav className="flex-1 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3">
                <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </nav>

          {/* Профиль скелетон */}
          <div className="mt-auto pt-6 border-t border-gray-100">
            <div className="flex items-center space-x-3 p-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="space-y-1">
                <div className="h-3 bg-gray-200 rounded w-16"></div>
                <div className="h-2 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (error || !user || !currentUserId) {
    return null;
  }

  const navigationItems = [
    {
      name: 'Главная',
      href: '/posts',
      icon: Home,
      active: pathname === '/posts'
    },
    {
      name: 'Поиск',
      href: undefined,
      icon: Search,
      active: isSearchOpen,
      onClick: () => setIsSearchOpen(prev => !prev)
    },
    {
      name: 'Создать',
      href: '/create',
      icon: PlusSquare,
      active: pathname === '/create'
    },
    {
      name: 'Профиль',
      href: `/profile/${user.username}`,
      icon: User,
      active: pathname?.startsWith('/profile')
    }
  ];

  const handleNavClick = (href?: string) => {
    if (isSearchOpen) setIsSearchOpen(false);
    if (onClose) onClose();
  };

  return (
    <>
      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {!isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
        fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-100 
        z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:relative
        w-80
      `}
      >
        <div className="flex flex-col h-full p-6">
          {/* Логотип в стиле Social Media */}
          <div className="px-4 py-6 mb-8 border-b border-gray-100">
            <Link 
              href="/" 
              onClick={() => handleNavClick('/')} 
              className="flex items-center space-x-3 text-2xl font-bold text-gray-900 hover:text-instagram-pink transition-colors duration-200"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-instagram-pink to-instagram-purple rounded-lg flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold">Shortlify</span>
            </Link>
          </div>

          {/* Навигация */}
          <nav className="flex-1 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.active;
              
              return item.href ? (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={`
                    flex items-center space-x-4 p-3 rounded-xl transition-all duration-200 group
                    ${isActive 
                      ? 'bg-gray-50 text-gray-900 font-semibold shadow-soft' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`
                    w-6 h-6 transition-colors duration-200
                    ${isActive 
                      ? 'text-instagram-pink' 
                      : 'text-gray-400 group-hover:text-instagram-pink'
                    }
                  `} />
                  <span className="text-sm font-medium">{item.name}</span>
                  {isActive && (
                    <div className="w-1 h-6 bg-instagram-pink rounded-full ml-auto"></div>
                  )}
                </Link>
              ) : (
                <button
                  key={item.name}
                  type="button"
                  onClick={item.onClick}
                  className={`
                    w-full flex items-center space-x-4 p-3 rounded-xl transition-all duration-200 group
                    ${isActive 
                      ? 'bg-gray-50 text-gray-900 font-semibold shadow-soft' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`
                    w-6 h-6 transition-colors duration-200
                    ${isActive 
                      ? 'text-instagram-pink' 
                      : 'text-gray-400 group-hover:text-instagram-pink'
                    }
                  `} />
                  <span className="text-sm font-medium">{item.name}</span>
                  {isActive && (
                    <div className="w-1 h-6 bg-instagram-pink rounded-full ml-auto"></div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Профиль пользователя */}
          <div className="mt-auto pt-6 border-t border-gray-100">
            <Link
              href={`/profile/${user.username}`}
              onClick={() => handleNavClick(`/profile/${user.username}`)}
              className={`
                flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 group
                ${pathname?.startsWith('/profile')
                  ? 'bg-gray-50 text-gray-900 font-semibold shadow-soft' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-instagram-pink to-instagram-purple flex items-center justify-center overflow-hidden border-2 border-white shadow-medium">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-sm font-semibold">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">@{user.username}</p>
              </div>
              {pathname?.startsWith('/profile') && (
                <div className="w-1 h-6 bg-instagram-pink rounded-full"></div>
              )}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}