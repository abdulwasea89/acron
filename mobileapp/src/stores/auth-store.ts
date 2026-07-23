import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStorage } from "./storage";

const mmkvStorage = createStorage("auth");

export type UserRole = "owner" | "manager" | "trainer" | "front_desk" | "member";

export interface AuthUser {
  user_id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  org_id: string;
  member_id?: string | null;
  member_status?: string | null;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;
}

export interface AuthActions {
  setSession: (tokens: { accessToken: string; refreshToken: string }, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoading: true,
      isHydrated: false,

      setSession: (tokens, user) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user, isLoading: false }),

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),

      setHydrated: (isHydrated) => set({ isHydrated }),

      clearSession: () =>
        set({ accessToken: null, refreshToken: null, user: null, isLoading: false }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => mmkvStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        state?.setLoading(false);
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
