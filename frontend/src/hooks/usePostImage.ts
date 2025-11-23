'use client';

import { useState, useEffect } from 'react';
import { getImageWithAuth } from '@/lib/api';

export const usePostImage = (imageUrl?: string) => {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        setLoading(true);
        setError(false);
        objectUrl = await getImageWithAuth(imageUrl);
        if (isMounted) setBlobUrl(objectUrl);
      } catch (err) {
        console.error('Failed to load post image:', imageUrl, err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  return { blobUrl, loading, error };
};
