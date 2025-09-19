'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Перенаправляем на страницу логина при загрузке главной страницы
    router.push('/login');
  }, [router]);
}