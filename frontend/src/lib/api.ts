import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: true, // Для куков
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  if (url.startsWith('/api/v1/')) {
    return `${BASE_URL}${url.replace('/api/v1/', '/')}`;
  }
  
  return `${BASE_URL}${url}`;
};

// Request interceptor - добавляет токен
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - обработка ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Типы для API
export interface LoginCredentials {
  emailOrUsername: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirmation: string; 
  username: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar_url?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Post {
  authorId: string | { id: string; username: string; name: string; avatar_url?: string; } | undefined;
  id: string;
  text: string;
  image_url?: string;
  user?: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreatePostData {
  text: string;
  image?: File;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  created_at: string;
}

export interface FollowInfo {
  id: string;
  username: string;
  name: string;
  avatar_url?: string;
}

export interface UpdatePostData {
  text: string;
  image?: File | null;
  remove_image?: boolean;
}

// Вспомогательная функция для извлечения данных
const unwrapData = <T>(response: { data: T }): T => {
  return response.data;
};

// API методы
export const authAPI = {
  login: async (credentials: { user: { email?: string; username?: string; password: string } }): Promise<AuthResponse> => {
    const response = await api.post('/login', credentials);
    return unwrapData(response);
  },

  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/signup', { user: userData });
    return unwrapData(response);
  },

  logout: async (): Promise<void> => {
    await api.delete('/logout');
    localStorage.removeItem('authToken');
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return unwrapData(response);
  }
};

export const postsAPI = {
  getFeedPosts: async (): Promise<Post[]> => {
    const response = await api.get('/posts');
    return unwrapData(response);
  },

  getPosts: async (): Promise<Post[]> => {
    const response = await api.get('/posts');
    return unwrapData(response);
  },
  
  getPost: async (id: string): Promise<Post> => {
    const response = await api.get(`/posts/${id}`);
    return unwrapData(response);
  },
  
  createPost: async (postData: CreatePostData): Promise<Post> => {
    const formData = new FormData();
    formData.append('text', postData.text);
    
    if (postData.image) {
      formData.append('image', postData.image);
    }

    const response = await api.post('/posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return unwrapData(response);
  },
 
  updatePost: async (id: string, postData: { text: string; image?: File | null }): Promise<Post> => {
    // проверка если есть файл изображения
    if (postData.image instanceof File) {
      const formData = new FormData();
      formData.append('text', postData.text);
      formData.append('image', postData.image);
      
      const response = await api.put(`/posts/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return unwrapData(response);
    } 
    
    // текстовое обновление
    const response = await api.put(`/posts/${id}`, { 
      text: postData.text 
    });
    return unwrapData(response);
  },
  
  deletePost: async (id: string): Promise<void> => {
    await api.delete(`/posts/${id}`);
  },

  getUserPosts: async (userId: string): Promise<Post[]> => {
    const response = await api.get(`/users/${userId}/posts`);
    return unwrapData(response);
  }
};

export const usersAPI = {
  getUser: async (id: string): Promise<UserProfile> => {
    const response = await api.get(`/users/${id}`);
    return unwrapData(response);
  },
  
  getCurrentUser: async (): Promise<UserProfile> => {
    const response = await api.get('/users/me');
    return unwrapData(response);
  },
  
  updateUser: async (id: string, userData: FormData): Promise<UserProfile> => {
    const response = await api.put(`/users/${id}/avatar`, userData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return unwrapData(response);
  },

  removeUser: async (id: string): Promise<UserProfile> => {
  try {
    console.log("Deleting user with ID:", id);
    const response = await api.delete(`/users/${id}`);
    console.log("Delete response:", response.status);
    return unwrapData(response);
  } catch (error) {
    console.error("Delete user error:", error);
    throw error;
  }
},
  
  removeAvatar: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/users/${id}/avatar`);
    return unwrapData(response);
  },
  
  searchUsers: async (query: string): Promise<UserProfile[]> => {
    const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
    return unwrapData(response);
  },
  
  followUser: async (id: string): Promise<UserProfile> => {
    const response = await api.post(`/users/${id}/follow`);
    return unwrapData(response);
  },
  
  unfollowUser: async (id: string): Promise<UserProfile> => {
    const response = await api.delete(`/users/${id}/unfollow`);
    return unwrapData(response); 
  },
  
  getFollowers: async (id: string): Promise<FollowInfo[]> => {
    const response = await api.get(`/users/${id}/followers`);
    return unwrapData(response);
  },
  
  getFollowing: async (id: string): Promise<FollowInfo[]> => {
    const response = await api.get(`/users/${id}/following`);
    return unwrapData(response);
  },
};

// Вспомогательные функции
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export const getImageWithAuth = async (imageUrl: string): Promise<string> => {
  try {
    // Очищаем URL от лишних параметров timestamp
    let cleanUrl = imageUrl;
    if (cleanUrl.includes('?t=')) {
      cleanUrl = cleanUrl.split('?t=')[0];
    }

    // Если URL относительный, добавляем базовый URL Rails-сервера
    let fullUrl = cleanUrl;
    if (cleanUrl.startsWith('/')) {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
      fullUrl = `${baseUrl}${cleanUrl}`;
    }

    console.log('Loading image from:', fullUrl);

    const token = localStorage.getItem('authToken');
    
    const response = await fetch(fullUrl, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Accept': 'image/*'
      },
      // credentials: 'include'
    });
    
    console.log('Image response status:', response.status);
    
    if (!response.ok) {
      console.warn('Image not available via auth, using direct URL');
      return fullUrl; // Возвращаем полный URL
    }
    
    const blob = await response.blob();
    console.log('Image loaded successfully, size:', blob.size);
    
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error loading image with auth, using direct URL:', error);
    // В случае ошибки возвращаем полный URL
    const cleanUrl = imageUrl.split('?t=')[0];
    if (cleanUrl.startsWith('/')) {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
      return `${baseUrl}${cleanUrl}`;
    }
    return cleanUrl;
  }
};