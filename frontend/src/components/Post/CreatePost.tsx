'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { Image, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function CreatePost() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    text: '',
    image: undefined as File | undefined
  });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const router = useRouter();

  const queryClient = useQueryClient();
  
  const createPostMutation = useMutation({
    mutationFn: postsAPI.createPost,
    onSuccess: (newPost) => {
      // Обновляем кэш, добавляя новый пост в начало
      queryClient.setQueryData(['posts'], (oldPosts: any[] = []) => [newPost, ...oldPosts]);
      setFormData({ text: '', image: undefined });
      setPreviewUrl('');
      setIsOpen(false);
      // Редирект на ленту постов после успешной публикации
      router.push('/posts');
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: undefined }));
    setPreviewUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const postData = {
      text: formData.text,
      image: formData.image
    };
    
    createPostMutation.mutate(postData);
  };

  if (!isOpen) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full text-left text-gray-500 hover:text-gray-700 p-3 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
        >
          О чем вы думаете?
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Создать пост</h3>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          placeholder="О чем вы думаете?"
          value={formData.text}
          onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Добавить изображение (необязательно)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="post-image"
          />
          <label
            htmlFor="post-image"
            className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Image className="w-4 h-4 mr-2" />
            Выбрать изображение
          </label>
        </div>

        {previewUrl && (
          <div className="relative">
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Предпросмотр"
                className="max-w-full max-h-96 object-contain rounded-md"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '384px', // max-h-96
                  width: 'auto',
                  height: 'auto'
                }}
                onLoad={(e) => {
                  // Автоматическая подстройка размера если нужно
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
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={createPostMutation.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {createPostMutation.isPending ? 'Публикуется...' : 'Опубликовать'}
          </button>
        </div>
      </form>
    </div>
  );
}