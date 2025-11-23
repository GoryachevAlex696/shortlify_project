"use client";

import { Post, getImageUrl } from "@/lib/api";
import { useState, useRef } from "react";
import { Edit, Trash2, MoreHorizontal, X, ImageIcon } from "lucide-react";
import { EditPostModal } from "@/components/Post/EditPostModal";
import { PlaceholderImage } from "@/components/Post/PlaceholderImage";

interface PostsGridProps {
  posts: Post[];
  username?: string;
  currentUserId?: string;
  onEdit?: (
    postId: string,
    data: { text: string; image?: File | null }
  ) => Promise<void>;
  onDelete?: (postId: string) => void;
}

export function PostsGrid({
  posts,
  username,
  currentUserId,
  onEdit,
  onDelete,
}: PostsGridProps) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Функция для получения абсолютного URL изображения
  const getAbsoluteImageUrl = (url: string | undefined): string => {
    if (!url) {
      console.log("URL is empty");
      return "";
    }

    // Если URL уже абсолютный, возвращаем как есть
    if (url.startsWith("http")) {
      console.log("Absolute URL:", url);
      return url;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || "http://localhost:3000";

    // Убедимся, что относительный URL начинается с /
    const relativeUrl = url.startsWith("/") ? url : `/${url}`;
    const absoluteUrl = `${baseUrl}${relativeUrl}`;

    console.log("Converted relative URL:", {
      original: url,
      baseUrl,
      relativeUrl,
      absoluteUrl
    });

    return absoluteUrl;
  };

  // Обработчик ошибки загрузки изображения
  const handleImageError = (postId: string, imageUrl: string) => {
    console.error(`Image load error for post ${postId}:`, imageUrl);
    setImageErrors(prev => new Set(prev).add(postId));
  };

  // Обработчик успешной загрузки изображения
  const handleImageLoad = (postId: string, imageUrl: string) => {
    console.log(`Image loaded successfully for post ${postId}:`, imageUrl);
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(postId);
      return newSet;
    });
  };

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">Публикаций пока нет</div>
    );
  }

  const handlePostClick = (post: Post) => {
    console.log("Post clicked:", post);
    console.log("Post image_url:", post.image_url);
    setSelectedPost(post);
    setShowOptions(false);
  };

  const handleCloseModal = () => {
    setSelectedPost(null);
    setShowOptions(false);
  };

  const handleEdit = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    setPostToEdit(post);
    setIsEditModalOpen(true);
    setShowOptions(false);
    handleCloseModal();
  };

  const handleDelete = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить этот пост?")) {
      onDelete?.(postId);
      handleCloseModal();
    }
    setShowOptions(false);
  };

  const handleSaveEdit = async (
    postId: string,
    data: { text: string; image?: File | null }
  ) => {
    try {
      if (onEdit) await onEdit(postId, data);
      setIsEditModalOpen(false);
      setPostToEdit(null);
    } catch (err) {
      console.error("Ошибка при сохранении изменений:", err);
    }
  };

  const isOwnPost = (post: Post) => {
    const authorId =
      typeof post.authorId === "string" ? post.authorId : post.authorId?.id;
    return authorId === currentUserId;
  };

  console.log("Rendering PostsGrid with posts:", posts);
  console.log("Image errors:", imageErrors);

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {posts.map((post) => {
          const postId = String(post.id);
          const hasError = imageErrors.has(postId);
          const imageUrl = post.image_url ? getAbsoluteImageUrl(post.image_url) : null;

          console.log(`Post ${postId}:`, {
            hasImage: !!post.image_url,
            imageUrl,
            hasError
          });

          return (
            <div
              key={post.id}
              className="relative group cursor-pointer aspect-square"
              onClick={() => handlePostClick(post)}
            >
              {imageUrl && !hasError ? (
                <img
                  src={imageUrl}
                  alt={`Post ${post.id}`}
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => handleImageError(postId, imageUrl)}
                  onLoad={() => handleImageLoad(postId, imageUrl)}
                />
              ) : (
                <PlaceholderImage className="w-full h-full rounded-lg" />
              )}
            </div>
          );
        })}
      </div>

      {/* Модальное окно просмотра поста */}
      {selectedPost && (
        <div
          className="fixed inset-0 bg-gradient-to-b from-black/30 to-black/30 z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
            >
              <X className="w-5 h-5" />
            </button>

            {isOwnPost(selectedPost) && (
              <div className="absolute top-4 left-4 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(!showOptions);
                  }}
                  className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {showOptions && (
                  <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-lg py-2 min-w-[120px] z-20">
                    <button
                      onClick={(e) => handleEdit(e, selectedPost)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Редактировать
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, selectedPost.id)}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="md:w-2/3 flex items-center justify-center bg-gray-100 p-4">
              {(() => {
                const postId = String(selectedPost.id);
                const hasError = imageErrors.has(postId);
                const imageUrl = selectedPost.image_url 
                  ? getAbsoluteImageUrl(selectedPost.image_url) 
                  : null;

                console.log("Modal image for post", postId, {
                  imageUrl,
                  hasError,
                  originalUrl: selectedPost.image_url
                });

                if (!imageUrl || hasError) {
                  return (
                    <div className="flex flex-col items-center justify-center w-full h-64 text-gray-400">
                      <ImageIcon className="w-16 h-16 mb-2" />
                      <p>Изображение не загружено</p>
                      <p className="text-xs mt-2">URL: {selectedPost.image_url || 'нет'}</p>
                    </div>
                  );
                }
                return (
                  <img
                    src={imageUrl}
                    alt={`Post ${selectedPost.id}`}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                    onError={() => handleImageError(postId, imageUrl)}
                    onLoad={() => handleImageLoad(postId, imageUrl)}
                  />
                );
              })()}
            </div>

            <div className="md:w-1/3 p-6 border-l border-gray-200">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Описание</h3>
                <p className="text-gray-700 mt-2">{selectedPost.text}</p>
              </div>

              <div className="text-sm text-gray-500">
                <p>
                  Опубликовано:{" "}
                  {new Date(selectedPost.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования */}
      {postToEdit && (
        <EditPostModal
          post={postToEdit}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setPostToEdit(null);
          }}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}