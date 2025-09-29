"use client";

import { Post, getImageUrl, getImageWithAuth } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
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

  // imageMap: postId -> разрешённый URL изображения (string) или null (явно нет изображения)
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});
  // loadingRef: отслеживаем, какие посты сейчас загружаются, чтобы не делать дублирующие запросы
  const loadingRef = useRef<Record<string, boolean>>({});
  // createdBlobUrlsRef: набор blob: URL, которые мы создали, чтобы отозвать их при размонтировании
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  // Загружаем изображения для всех постов при изменении списка posts
  useEffect(() => {
    let mounted = true;

    const loadAll = async () => {
      if (!posts || posts.length === 0) return;

      for (const p of posts) {
        try {
          if (!p || !p.id) continue;
          const pid = String(p.id);

          // Пропускаем, если уже загружено или уже идёт загрузка
          if (imageMap[pid] !== undefined || loadingRef.current[pid]) continue;

          loadingRef.current[pid] = true;

          // Если у поста нет image_url, явно помечаем как null
          if (!p.image_url) {
            if (!mounted) break;
            setImageMap((prev) => ({ ...prev, [pid]: null }));
            loadingRef.current[pid] = false;
            continue;
          }

          try {
            // Пытаемся получить изображение через getImageWithAuth (поддержка приватных изображений)
            const resolved = await getImageWithAuth(p.image_url);
            if (!mounted) {
              // Если уже размонтированы — отзываем blob URL, если он создан
              if (typeof resolved === "string" && resolved.startsWith("blob:")) {
                try {
                  URL.revokeObjectURL(resolved);
                } catch {}
              }
              break;
            }

            if (typeof resolved === "string" && resolved.startsWith("blob:")) {
              createdBlobUrlsRef.current.add(resolved);
            }

            setImageMap((prev) => ({ ...prev, [pid]: resolved }));
          } catch (err) {
            // При ошибке fallback на публичный URL
            console.warn("Не удалось загрузить через getImageWithAuth, делаю fallback:", err);
            const fallback = getImageUrl(p.image_url);
            setImageMap((prev) => ({ ...prev, [pid]: fallback ?? null }));
          } finally {
            loadingRef.current[pid] = false;
          }
        } catch (outer) {
          console.error("Ошибка при загрузке изображения поста:", outer);
        }
      }
    };

    loadAll();

    return () => {
      mounted = false;
      // Отзываем все созданные blob URL при размонтировании
      createdBlobUrlsRef.current.forEach((b) => {
        try {
          URL.revokeObjectURL(b);
        } catch {}
      });
      createdBlobUrlsRef.current.clear();
    };
    // Зависимость — posts (imageMap не включаем, чтобы не зациклить)
  }, [posts]);

  // Очищаем записи imageMap для удалённых постов и отзываем blob для них
  useEffect(() => {
    const existing = new Set((posts || []).map((p) => String(p.id)));
    setImageMap((prev) => {
      const next: Record<string, string | null> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (existing.has(k)) next[k] = v;
        else {
          // Если пост удалён, отзываем blob url
          if (v && v.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(v);
              createdBlobUrlsRef.current.delete(v);
            } catch {}
          }
        }
      });
      return next;
    });
  }, [posts]);

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

  // Обработчик ошибки загрузки <img>: помечаем пост как не имеющий изображения и отзываем blob, если нужно
  const handleImgOnError = (postId: string, src?: string) => {
    if (src && src.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(src);
        createdBlobUrlsRef.current.delete(src);
      } catch {}
    }
    setImageMap((prev) => ({ ...prev, [String(postId)]: null }));
  };

  const isOwnPost = (post: Post) => {
    const authorId =
      typeof post.authorId === "string" ? post.authorId : post.authorId?.id;
    return authorId === currentUserId;
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {posts.map((post) => {
          const pid = String(post.id);
          // Сначала используем разрешённый auth-aware URL из imageMap;
          // если он ещё не загружен — используем публичный fallback
          const resolved = imageMap[pid];
          const fallbackPublic = getImageUrl(post.image_url);
          const imageUrlToUse = resolved === undefined ? fallbackPublic : resolved;

          return (
            <div
              key={post.id}
              className="relative group cursor-pointer aspect-square"
              onClick={() => handlePostClick(post)}
            >
              {imageUrlToUse ? (
                <img
                  src={imageUrlToUse}
                  alt={`Post ${post.id}`}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => handleImgOnError(pid, e.currentTarget.src)}
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
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
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
                const pid = String(selectedPost.id);
                const resolved = imageMap[pid];
                const fallbackPublic = getImageUrl(selectedPost.image_url);
                const url = resolved === undefined ? fallbackPublic : resolved;
                if (!url) {
                  return (
                    <div className="flex flex-col items-center justify-center w-full h-64 text-gray-400">
                      <ImageIcon className="w-16 h-16 mb-2" />
                      <p>Изображение не загружено</p>
                    </div>
                  );
                }
                return (
                  <img
                    src={url}
                    alt={`Post ${selectedPost.id}`}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                    onError={(e) => handleImgOnError(pid, e.currentTarget.src)}
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