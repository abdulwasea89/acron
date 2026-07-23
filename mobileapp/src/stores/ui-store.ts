import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

export interface UiState {
  isLoading: boolean;
  toasts: Toast[];
}

export interface UiActions {
  setLoading: (loading: boolean) => void;
  showToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

let toastId = 0;

export const useUiStore = create<UiState & UiActions>()((set) => ({
  isLoading: false,
  toasts: [],

  setLoading: (isLoading) => set({ isLoading }),

  showToast: (message, type = "info") => {
    const id = String(++toastId);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
