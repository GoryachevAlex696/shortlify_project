"use client";

import { Post, getImageUrl } from "@/lib/api";
import { useState } from "react";
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

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">Публикаций пока нет</div>
    );
  }

  const handlePostClick = (post: Post) => {
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
    handleCloseModal(); // Закрываем модалку просмотра поста
  };

  const handleDelete = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить этот пост?")) {
      onDelete?.(postId);
      handleCloseModal(); // Закрываем модалку после удаления
    }
    setShowOptions(false);
  };

  const handleSaveEdit = async (
    postId: string,
    data: { text: string; image?: File | null }
  ) => {
    console.log("Saving edit for post:", postId, data);
    try {
      if (onEdit) {
        await onEdit(postId, data);
        console.log("Edit saved successfully");
      } else {
        console.error("onEdit function is not provided");
      }
      setIsEditModalOpen(false);
      setPostToEdit(null);
    } catch (error) {
      console.error("Error saving edit:", error);
    }
  };

  const handleImageError = (postId: string) => {
    console.error("Image load error for post:", postId);
    setImageErrors((prev) => new Set(prev).add(postId));
  };

  const isImageError = (postId: string) => {
    return imageErrors.has(postId);
  };

  const isOwnPost = (post: Post) => {
    const authorId =
      typeof post.authorId === "string" ? post.authorId : post.authorId?.id;
    return authorId === currentUserId;
  };

  console.log("Raw posts data from server:", posts);
  if (posts && posts.length > 0) {
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {posts.map((post) => {
          const imageUrl = getImageUrl(post.image_url);
          const hasImageError = isImageError(post.id);

          return (
            <div
              key={post.id}
              className="relative group cursor-pointer aspect-square"
              onClick={() => handlePostClick(post)}
            >
              {imageUrl && !hasImageError ? (
                <img
                  src={imageUrl}
                  alt={`Post ${post.id}`}
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => handleImageError(post.id)}
                />
              ) : (
                <PlaceholderImage className="w-full h-full rounded-lg" />
              )}
            </div>
          );
        })}
      </div>

      {/* Модальное окно поста */}
      {selectedPost && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Кнопка закрытия */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Кнопка опций (три точки) */}
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

            {/* Изображение */}
            <div className="md:w-2/3 flex items-center justify-center bg-gray-100 p-4">
              {(() => {
                const imageUrl = getImageUrl(selectedPost.image_url);
                const hasImageError = isImageError(selectedPost.id);

                return imageUrl && !hasImageError ? (
                  <img
                    src={imageUrl}
                    alt={`Post ${selectedPost.id}`}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                    onError={() => handleImageError(selectedPost.id)}
                    onLoad={() =>
                      console.log("Image loaded successfully:", imageUrl)
                    }
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-64 text-gray-400">
                    <ImageIcon className="w-16 h-16 mb-2" />
                    <p>Изображение не загружено</p>
                    {imageUrl && (
                      <p className="text-xs text-gray-500 mt-2">
                        URL: {imageUrl}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Информация о посте */}
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
