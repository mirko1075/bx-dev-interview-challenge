import { api } from './api.service';
import { LoginCredentials, AuthResponse, User } from '@/types';

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // La nostra nuova 'api' restituisce direttamente i dati, non un oggetto { data: ... }
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  return response; // <-- Rimuovi .data
};

export const register = async (credentials: LoginCredentials): Promise<User> => {
  const response = await api.post<User>('/auth/register', credentials);
  return response; // <-- Rimuovi .data
};

