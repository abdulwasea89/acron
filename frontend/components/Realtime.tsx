"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRealtime, type RtEvent, type RtStatus } from "@/hooks/useRealtime";

type Handler = (e: RtEvent) => void;

const StatusContext = createContext<RtStatus>("connecting");
const SubscribeContext = createContext<(fn: Handler) => () => void>(() => () => {});

/** Owns the single app-wide WebSocket. Fans events out to page subscribers. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const handlers = useRef(new Set<Handler>());

  const subscribe = useCallback((fn: Handler) => {
    handlers.current.add(fn);
    return () => handlers.current.delete(fn);
  }, []);

  const status = useRealtime(useCallback((e: RtEvent) => {
    handlers.current.forEach((fn) => fn(e));
  }, []));

  return (
    <StatusContext.Provider value={status}>
      <SubscribeContext.Provider value={subscribe}>{children}</SubscribeContext.Provider>
    </StatusContext.Provider>
  );
}

export const useRealtimeStatus = () => useContext(StatusContext);

/** Run `handler` on realtime events whose `type` is in `types`. */
export function useRealtimeEvent(types: string[], handler: Handler) {
  const subscribe = useContext(SubscribeContext);
  const handlerRef = useRef(handler);
  // Assigned in an effect, not during render: the subscription below is keyed
  // only on the event types, so the ref lets it always call the latest handler
  // without resubscribing on every render.
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  const key = types.join(",");

  useEffect(() => {
    const set = new Set(key.split(","));
    return subscribe((e) => set.has(e.type) && handlerRef.current(e));
  }, [subscribe, key]);
}

const DOT: Record<RtStatus, { color: string; label: string; pulse: boolean }> = {
  live: { color: "bg-[var(--success)]", label: "Live", pulse: false },
  connecting: { color: "bg-[var(--warning)]", label: "Connecting", pulse: true },
  reconnecting: { color: "bg-[var(--warning)]", label: "Reconnecting", pulse: true },
  offline: { color: "bg-[var(--muted)]", label: "Offline", pulse: false },
};

/** Compact connection indicator for the sidebar/header. */
export function LiveIndicator({ className = "" }: { className?: string }) {
  const status = useRealtimeStatus();
  const { color, label, pulse } = DOT[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--foreground-muted)] ${className}`}>
      <span className="relative flex h-2 w-2">
        {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
      {label}
    </span>
  );
}

/** Thin top banner shown only while the connection is degraded. */
export function OfflineBanner() {
  const status = useRealtimeStatus();
  const [show, setShow] = useState(false);

  // Both transitions go through a timer so the effect body never sets state
  // synchronously: a brief blip is debounced away, and a recovery hides the
  // banner on the next tick.
  useEffect(() => {
    const timer = setTimeout(() => setShow(status !== "live"), status === "live" ? 0 : 2500);
    return () => clearTimeout(timer);
  }, [status]);

  if (!show) return null;
  return (
    <div className="sticky top-0 z-30 border-b border-[var(--warning-border)] bg-[var(--warning-bg)]/90 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--warning)] backdrop-blur">
      Reconnecting — showing last known data.
    </div>
  );
}
