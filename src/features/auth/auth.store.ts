import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from './auth.api';
import type { AuthUser } from './auth.types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUserFromToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      login: async (email, password) => {
        const { access_token } = await authApi.login({ email, password });
        set({ token: access_token });
        try {
          const user = await authApi.getStatus();
          set({ user });
        } catch {
          // Token valid but /user/status failed — keep token, user stays null
        }
      },

      logout: () => {
        set({ token: null, user: null });
      },

      loadUserFromToken: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const user = await authApi.getStatus();
          set({ user });
        } catch {
          // If 401, http.ts already clears storage + redirects
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

export const useIsAuthenticated = () =>
  useAuthStore((s) => !!s.token);
