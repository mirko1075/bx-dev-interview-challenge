import api from './api.service';

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface AuthResponse {
  accessToken: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  return response.data;
};

export const register = async (credentials: LoginCredentials): Promise<User> => {
    const response = await api.post<User>('/auth/register', credentials);
    return response.data;
}

