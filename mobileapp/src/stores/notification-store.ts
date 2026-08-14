import { create } from "zustand";

interface NotificationState {
  /** Live unread count shown on the bell badge. */
  unreadCount: number;
  /** A live alert just arrived (bumped when a WS event lands). */
  lastBumpAt: number;
  setUnreadCount: (count: number) => void;
  bump: () => void;
  /** Decrement by `n` after reading alerts locally. Never goes negative. */
  decrement: (n?: number) => void;
}

/**
 * In-memory unread badge state. Seeded from the API once at app launch, then
 * kept fresh by the WebSocket client (`notification.created`) and by the
 * notifications screen when it marks items read. Not persisted — the count is
 * derived server state, and the server is the source of truth.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  lastBumpAt: 0,

  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),

  bump: () => set((s) => ({ unreadCount: s.unreadCount + 1, lastBumpAt: Date.now() })),

  decrement: (n = 1) => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - n) })),
}));