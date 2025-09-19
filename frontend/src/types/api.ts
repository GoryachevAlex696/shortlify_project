export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar_url?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
}

export interface Post {
  id: string;
  text: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  user: User;
  likes_count: number;
  comments_count: number;
  liked: boolean;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>; 
  status?: number; 
}