import { ApiError } from '../types/api';
import axios from 'axios';

export const handleApiError = (error: any): ApiError => {
  if (axios.isAxiosError(error)) {
    return {
      message: error.response?.data?.error || error.message,
      errors: error.response?.data?.errors,
      status: error.response?.status
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