import { create } from 'zustand';
import type { User } from '../types';
import * as authApi from '../api/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  setUser: (user: User) => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const profile = await authApi.getProfile();
    set({ accessToken: data.access, refreshToken: data.refresh, user: profile.data });
  },

  logout: async () => {
    const refresh = get().refreshToken;
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // best-effort blacklist
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ accessToken: null, refreshToken: null, user: null });
  },

  refreshAccessToken: async () => {
    const refresh = get().refreshToken;
    if (!refresh) throw new Error('No refresh token');
    const { data } = await authApi.refreshToken(refresh);
    localStorage.setItem('access_token', data.access);
    set({ accessToken: data.access });
  },

  setUser: (user) => set({ user }),
}));

export default useAuthStore;
