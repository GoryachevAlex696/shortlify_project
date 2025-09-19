'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authAPI, AuthResponse } from '../../lib/api';
import { ApiError } from '../../types/api';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface LoginCredentials {
  emailOrUsername: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  password_confirmation: string; 
  username: string;
  name: string;
}

// ---------------------- LOGIN ----------------------
export const useLogin = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<AuthResponse, ApiError, LoginCredentials>({
    mutationFn: async (credentials: LoginCredentials) => {
      const isEmail = credentials.emailOrUsername.includes('@');
      const requestData = isEmail
        ? { user: { email: credentials.emailOrUsername, password: credentials.password } }
        : { user: { username: credentials.emailOrUsername, password: credentials.password } };

      return await authAPI.login(requestData);
    },
    onSuccess: (data) => {
      if (!data.user) {
        console.error('Login succeeded but data.user is undefined', data);
        return;
      }

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));

      if (data.user.id) {
        localStorage.setItem('currentUserId', String(data.user.id));
      }

      queryClient.setQueryData(['currentUser'], data.user);
      router.push('/posts');
    },
    onError: (error) => {
      console.error('Login failed:', error);
    }
  });
};

// ---------------------- REGISTER ----------------------
export const useRegister = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<AuthResponse, ApiError, RegisterData>({
    mutationFn: authAPI.register,
    onSuccess: (data) => {
      // Сохраняем токен
      localStorage.setItem('authToken', data.token);

      // Не сохраняем currentUser, будем получать через useCurrentUser после авторизации
      queryClient.removeQueries({ queryKey: ['currentUser'] }); // очистка кэша

      // Редирект на ленту
      router.push('/posts');
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    }
  });
};

// ---------------------- CURRENT USER ----------------------
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => {
      if (typeof window !== 'undefined') {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            if (parsed && typeof parsed === 'object') return parsed;
            localStorage.removeItem('currentUser');
          } catch (error) {
            console.error('Error parsing user data:', error, 'Data:', userData);
            localStorage.removeItem('currentUser');
          }
        }
      }
      return null;
    },
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('authToken'),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
};

// ---------------------- LOGOUT ----------------------
export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: authAPI.logout,
    onSuccess: () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentUserId');
      queryClient.removeQueries({ queryKey: ['currentUser'] });
      queryClient.clear();
      router.push('/login');
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentUserId');
      queryClient.removeQueries({ queryKey: ['currentUser'] });
      router.push('/login');
    }
  });
};

// ---------------------- CURRENT USER ID ----------------------
export const useCurrentUserId = (): string | null => {
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentUserId');
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('currentUserId');
      if (id !== userId) setUserId(id);
    }
  }, []);

  return userId;
};

// ---------------------- AUTH HOOK ----------------------
export const useAuth = () => {
  const userId = useCurrentUserId();
  const { data: user, isLoading, error } = useCurrentUser();
  const queryClient = useQueryClient();

  const hasAuthToken = typeof window !== 'undefined' && !!localStorage.getItem('authToken');

  // Гидратация кэша React Query с localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = queryClient.getQueryData(['currentUser']);
    if (!cached) {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            queryClient.setQueryData(['currentUser'], parsed);
          }
        } catch (e) {
          console.error('Failed to parse currentUser from localStorage during hydrate', e);
        }
      }
    }
  }, [queryClient]);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: hasAuthToken,
  };
};

// ---------------------- ВСПОМОГАТЕЛЬНЫЕ ----------------------
const getUserIdFromToken = (): string | null => {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.user_id || decoded.sub || null;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const getUserIdFromUserData = (): string | null => {
  const userData = localStorage.getItem('currentUser');
  if (!userData) return null;

  try {
    const user = JSON.parse(userData);
    return user.id || null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};