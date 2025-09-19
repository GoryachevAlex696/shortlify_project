'use client';

import { useState, useEffect } from 'react';
import { getImageWithAuth } from '@/lib/api';

export const useImageWithAuth = (imageUrl: string | undefined) => {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      if (!imageUrl) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        
        const url = await getImageWithAuth(imageUrl);
        setBlobUrl(url);
      } catch (err) {
        console.error('Ощибка загрузки изображения:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    // Очистка при размонтировании
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [imageUrl]);

  return { blobUrl, loading, error };
};