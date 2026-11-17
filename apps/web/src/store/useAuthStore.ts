import { create } from 'zustand';
import type { LoginInput, RegisterInput, User } from '@droneverse/shared';
import { api, tokenStorage } from '../lib/api';

interface AuthState {
  user: User | null;
  /** True until the stored token (if any) has been checked. */
  loading: boolean;
  init: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    if (!tokenStorage.get()) return set({ loading: false });
    try {
      const { user } = await api.me();
      set({ user, loading: false });
    } catch {
      tokenStorage.clear();
      set({ user: null, loading: false });
    }
  },

  login: async (input) => {
    const { token, user } = await api.login(input);
    tokenStorage.set(token);
    set({ user });
  },

  register: async (input) => {
    const { token, user } = await api.register(input);
    tokenStorage.set(token);
    set({ user });
  },

  logout: async () => {
    await api.logout().catch(() => {});
    tokenStorage.clear();
    set({ user: null });
  },

  clear: () => {
    tokenStorage.clear();
    set({ user: null });
  },
}));
