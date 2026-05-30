import { create } from "zustand";
import { AuthUser, authApi, saveAuthSession, clearAuthSession, getStoredUser, getStoredToken } from "../lib/api";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  loading: false,
  error: null,

  login: async (payload) => {
    set({ loading: true, error: null });
    try {
      const response = await authApi.login(payload);
      saveAuthSession(response);
      set({ user: response.user, token: response.accessToken, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Đăng nhập thất bại", loading: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const response = await authApi.register(payload);
      saveAuthSession(response);
      set({ user: response.user, token: response.accessToken, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Đăng ký thất bại", loading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout request failed", err);
    } finally {
      clearAuthSession();
      set({ user: null, token: null, loading: false });
    }
  },

  checkSession: () => {
    set({
      user: getStoredUser(),
      token: getStoredToken()
    });
  },

  clearError: () => set({ error: null })
}));
