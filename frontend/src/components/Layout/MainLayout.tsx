'use client';

import { useCurrentUserId } from '@/hooks/auth/useAuth';
import { Sidebar } from './Sidebar';
import { useSidebar } from '@/app/contexts/SidebarContext'; 
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useSidebar();
  const currentUserId = useCurrentUserId();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const publicRoutes = ['/login', '/register', '/forgot-password'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;
  
  // Показываем простой лоадер на сервере
  if (!isClient) {
    return (
      <div className="flex h-screen bg-gray-50">
        <main className="flex-1 flex items-center justify-center">
          <div>Загрузка...</div>
        </main>
      </div>
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className={!currentUserId ? 'hidden' : ''}>
        <Sidebar isOpen={isSidebarOpen} />
      </div>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Shortlify</h1>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}