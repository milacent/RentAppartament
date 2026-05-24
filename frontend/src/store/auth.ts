/**
 * Auth Store (Zustand)
 */
import { create } from 'zustand';
import { User } from '@/types';

interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  setAuth: (token: string, refreshToken: string, user: User) => void;
  initializeAuth: () => void;
  logout: () => void;
  setUser: (user: User) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const getStoredAuth = () => {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  const storedUser = localStorage.getItem('user');

  if (!token || !refreshToken || !storedUser) return null;

  try {
    return {
      token,
      refreshToken,
      user: JSON.parse(storedUser) as User,
    };
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return null;
  }
};

const storedAuth = getStoredAuth();

export const useAuthStore = create<AuthStore>((set) => ({
  user: storedAuth?.user ?? null,
  token: storedAuth?.token ?? null,
  refreshToken: storedAuth?.refreshToken ?? null,
  isAuthenticated: Boolean(storedAuth),
  isLoading: false,
  error: null,
  
  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, refreshToken, user, isAuthenticated: true, error: null });
  },

  initializeAuth: () => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const storedUser = localStorage.getItem('user');

    if (!token || !refreshToken || !storedUser) {
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      return;
    }

    try {
      const user = JSON.parse(storedUser) as User;
      set({ token, refreshToken, user, isAuthenticated: true, error: null });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
  },
  
  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
}));
