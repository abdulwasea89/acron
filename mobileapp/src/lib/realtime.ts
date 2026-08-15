import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "@/stores/notification-store";

export type RealtimeEvent = Record<string, unknown> & { type: string };
type EventListener = (event: RealtimeEvent) => void;

const listeners = new Set<EventListener>();

/** Subscribe to every realtime event received on the socket. Returns an unsubscribe fn. */
export function onRealtimeEvent(cb: EventListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(event: RealtimeEvent) {
  for (const cb of Array.from(listeners)) {
    try {
      cb(event);
    } catch {
      /* a subscriber must never break the socket loop */
    }
  }
}

/**
 * WebSocket realtime client (Section 16).
 *
 * Connects to the backend's `/api/v1/ws?token=<access_jwt>` endpoint — the
 * token is a query param because RN WebSocket can't set an Authorization
 * header. The server scopes sockets by org AND user, so the only event that
 * matters here is `notification.created`, which arrives only for the signed-in
 * user. It bumps the unread badge instantly.
 *
 * Lifecycle: `startRealtime` opens a socket when authenticated; `stopRealtime`
 * tears it down. On disconnect it reconnects with capped exponential backoff
 * and keeps the connection alive with a 30s `ping`. If the access token was
 * refreshed in the meantime, a fresh token is read at connect time.
 */

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const PREFIX = "/api/v1";

function wsUrl(token: string): string {
  const wsBase = BASE_URL.replace(/^http/, "ws");
  return `${wsBase}${PREFIX}/ws?token=${encodeURIComponent(token)}`;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let backoffMs = 2000;
let closedByUs = false;

function scheduleReconnect() {
  if (reconnectTimer || closedByUs) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, 30_000);
}

function teardown() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function connect() {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    stopRealtime();
    return;
  }

  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl(token));
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    backoffMs = 2000;
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send("ping");
        } catch {
          /* socket dying; onclose will reconnect */
        }
      }
    }, 30_000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(String(event.data));
      if (data.type === "notification.created") {
        useNotificationStore.getState().bump();
      }
      emit(data);
    } catch {
      /* non-JSON frame — ignore */
    }
  };

  ws.onclose = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (socket === ws) socket = null;
    if (!closedByUs) scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose always follows; let it handle teardown/reconnect.
  };
}

/** Open a realtime connection when authenticated. Idempotent. */
export function startRealtime() {
  if (socket || reconnectTimer) return;
  if (!useAuthStore.getState().accessToken) return;
  closedByUs = false;
  connect();
}

/**
 * Tear down and reconnect with the current token — call after the auth token
 * changes (login, refresh, org switch, logout).
 */
export function restartRealtime() {
  teardown();
  closedByUs = true;
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    socket = null;
  }
  startRealtime();
}

/** Close the connection for good (logout / app background). */
export function stopRealtime() {
  teardown();
  closedByUs = true;
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    socket = null;
  }
}
