import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers'; // Импортируем React Query провайдер
import { SidebarProvider } from './contexts/SidebarContext'; // Боковая панель
import { MainLayout } from '@/components/Layout/MainLayout'; // Главный layout
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Shortlify',
  description: 'Социальная сеть для общения и публикации постов',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Providers> {/* 1. React Query Provider */}
          <SidebarProvider> {/* 2. Sidebar Context */}
            <MainLayout> {/* 3. Main Layout с навигацией */}
              {children} {/* 4. Дочерние страницы */}
            </MainLayout>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}