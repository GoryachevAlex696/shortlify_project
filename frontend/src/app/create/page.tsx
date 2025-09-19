// src/app/create/page.tsx
'use client';

import { CreatePost } from '@/components/Post/CreatePost';

export default function CreatePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Создать пост</h1>
        <p className="text-gray-600 text-lg mb-6">Создайте новую запись</p>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <CreatePost />
        </div>
      </div>
    </div>
  );
}