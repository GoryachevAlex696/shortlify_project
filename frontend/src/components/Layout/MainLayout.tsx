'use client';

import { useCurrentUserId } from '@/hooks/auth/useAuth';
import { Sidebar } from './Sidebar';
import { useSidebar } from '@/app/contexts/SidebarContext'; 
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useSidebar();
  const currentUserId = useCurrentUserId();
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Список публичных (auth) роутов, где боковая панель показывать не нужно
  const publicRoutes = ['/login', '/register', '/forgot-password'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar: рендерим только после монтирования, когда есть userId, и если это не публичный роут */}
      <div className={`${isSidebarOpen ? 'lg:block' : 'lg:block'}`}>
        {isMounted && currentUserId && !isPublicRoute && (
          <Sidebar isOpen={isSidebarOpen} />
        )}
      </div>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header - показываем только когда есть sidebar и не на публичном роуте */}
        {isMounted && currentUserId && !isPublicRoute && (
          <header className="lg:hidden bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Shortlify</h1>
              <div className="w-6" />
            </div>
          </header>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutContent>{children}</LayoutContent>
  );
}