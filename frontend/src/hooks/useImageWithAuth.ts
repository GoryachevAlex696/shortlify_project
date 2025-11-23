'use client';

import { useState, useEffect } from 'react';
import { getImageWithAuth } from '@/lib/api';

export const useImageWithAuth = (imageUrl: string | undefined) => {
  const [blobUrl, setBlobUrl] = useState<string>(''); // URL для <img>
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true; // чтобы не обновлять state после размонтирования
    let objectUrl: string | null = null;

    const loadImage = async () => {
      if (!imageUrl) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        const url = await getImageWithAuth(imageUrl);

        if (!isMounted) return;

        objectUrl = url;
        setBlobUrl(objectUrl);
      } catch (err) {
        console.error('Ошибка загрузки изображения:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageUrl]);

  return { blobUrl, loading, error };
};
