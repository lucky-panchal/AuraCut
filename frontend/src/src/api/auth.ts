import client from './client';
import type { User } from '../types';

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  display_name?: string;
  avatar?: File;
}

export const register = (payload: RegisterPayload) =>
  client.post<AuthTokens>('/api/auth/register/', payload);

export const login = (payload: LoginPayload) =>
  client.post<AuthTokens>('/api/auth/login/', payload);

export const logout = (refresh: string) =>
  client.post('/api/auth/logout/', { refresh });

export const refreshToken = (refresh: string) =>
  client.post<{ access: string }>('/api/auth/refresh/', { refresh });

export const getProfile = () =>
  client.get<User>('/api/auth/profile/');

export const updateProfile = (payload: UpdateProfilePayload) => {
  const form = new FormData();
  if (payload.display_name) form.append('display_name', payload.display_name);
  if (payload.avatar) form.append('avatar', payload.avatar);
  return client.patch<User>('/api/auth/profile/', form);
};
