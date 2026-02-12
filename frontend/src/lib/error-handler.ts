import { ApiError } from '../types/api';
import axios from 'axios';

export const handleApiError = (error: any): ApiError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    // СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ 422
    if (status === 422) {
      
      // Проверяем формат ошибки
      if (data?.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors[0] || '';
        
        // Проверяем, связана ли ошибка с email
        if (errorMessage.toLowerCase().includes('email') && 
            (errorMessage.toLowerCase().includes('taken') || 
             errorMessage.toLowerCase().includes('exists'))) {
          return {
            message: 'Этот email уже зарегистрирован. Пожалуйста, используйте другой email или войдите в аккаунт.',
            errors: { email: [errorMessage] },
            status: 422
          };
        }
        
        // Проверяем, связана ли ошибка с username
        if (errorMessage.toLowerCase().includes('username') && 
            errorMessage.toLowerCase().includes('taken')) {
          return {
            message: 'Это имя пользователя уже занято. Пожалуйста, выберите другое.',
            errors: { username: [errorMessage] },
            status: 422
          };
        }
        
        // Общая ошибка валидации
        return {
          message: errorMessage || 'Проверьте правильность заполнения полей',
          errors: { general: data.errors },
          status: 422
        };
      }
      
      // Другие возможные форматы (на всякий случай)
      if (data?.message) {
        return {
          message: data.message,
          errors: data.errors,
          status: 422
        };
      }
      
      return {
        message: data?.error || 'Проверьте правильность заполнения полей',
        errors: data?.errors,
        status: 422
      };
    }

    // Обработка других статусов
    return {
      message: data?.error || data?.message || error.message,
      errors: data?.errors,
      status
    };
  }
  
  return {
    message: 'Произошла непредвиденная ошибка.'
  };
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};