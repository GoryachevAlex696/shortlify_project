"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsAPI } from "@/lib/api";
import { PostCard } from "@/components/Post/PostCard";
import { CreatePost } from "@/components/Post/CreatePost";
import { EditPostModal } from "@/components/Post/EditPostModal";
import { Loader2 } from "lucide-react";
import { useAuth, useCurrentUserId } from "@/hooks/auth/useAuth";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function PostsPage() {
  const { user: currentUser } = useAuth();
  const [editingPost, setEditingPost] = useState<any>(null);
  const currentUserId = useCurrentUserId();
  const searchParams = useSearchParams();
  const highlightPostId = searchParams.get("highlight");

  const {
    data: posts,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["posts"],
    queryFn: postsAPI.getFeedPosts,
    staleTime: 1000 * 60 * 5,
  });

  const queryClient = useQueryClient();

  // Обработка подсветки поста из поиска
  useEffect(() => {
    if (highlightPostId && posts) {
      // небольшая задержка для того чтобы посты успели отрендериться
      const timer = setTimeout(() => {
        const postElement = document.getElementById(`post-${highlightPostId}`);
        if (postElement) {
          postElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Добавляем временную подсветку
          postElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
          setTimeout(() => {
            postElement.classList.remove(
              "ring-2",
              "ring-blue-500",
              "ring-offset-2"
            );
          }, 3000);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [highlightPostId, posts]);

  // Обработчик кастомного события для скролла к посту
  useEffect(() => {
    const handleScrollToPost = (event: CustomEvent) => {
      const postId = event.detail.postId;
      const postElement = document.getElementById(`post-${postId}`);
      if (postElement) {
        postElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Подсветка поста
        postElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
        setTimeout(() => {
          postElement.classList.remove(
            "ring-2",
            "ring-blue-500",
            "ring-offset-2"
          );
        }, 3000);
      }
    };

    window.addEventListener(
      "scrollToPost",
      handleScrollToPost as EventListener
    );
    return () =>
      window.removeEventListener(
        "scrollToPost",
        handleScrollToPost as EventListener
      );
  }, []);

  const deletePostMutation = useMutation({
    mutationFn: postsAPI.deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { text: string; image?: File | null };
    }) => postsAPI.updatePost(id, data),
    onSuccess: (updatedPost) => {
      queryClient.setQueryData(["posts"], (oldPosts: any) => {
        if (!oldPosts) return [updatedPost];
        return oldPosts.map((post: any) =>
          post.id === updatedPost.id ? updatedPost : post
        );
      });

      setEditingPost(null);
    },
  });

  const handleEdit = (post: any) => {
    setEditingPost(post);
  };

  const handleSave = async (
    postId: string,
    data: { text: string; image?: File | null }
  ) => {
    try {
      await updatePostMutation.mutateAsync({
        id: postId,
        data,
      });
    } catch (error) {
      console.error("Error updating post:", error);
      throw error;
    }
  };

  const handleCloseModal = () => {
    setEditingPost(null);
  };

  const handleDelete = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Загрузка...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center text-red-500 py-12">
            Ошибка загрузки постов. Попробуйте ещё раз.
          </div>
          <div className="text-center">
            <button
              onClick={() => refetch()}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Ваша лента</h1>
          <p className="text-gray-600">
            Смотрите актуальные новости вашей сети
          </p>
        </div>

        <div className="space-y-4">
          {posts && posts.length > 0 ? (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onEdit={handleEdit}
                onDelete={handleDelete}
                currentUserId={currentUserId}
                id={`post-${post.id}`} // Добавляем ID для скролла
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Пока нет постов</p>
              <p className="text-gray-400">
                Подпишитесь на пользователей, чтобы видеть их записи!
              </p>
            </div>
          )}
        </div>

        {editingPost && (
          <EditPostModal
            post={editingPost}
            isOpen={!!editingPost}
            onClose={handleCloseModal}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
