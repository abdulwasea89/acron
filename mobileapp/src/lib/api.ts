import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { generateIdempotencyKey, markIdempotencyDone } from "@/lib/idempotency";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  idempotent?: boolean;
  isFormData?: boolean;
}

async function refreshTokens(): Promise<boolean> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  const { activeOrg } = useOrgStore.getState();

  if (!refreshToken) {
    clearSession();
    return false;
  }

  try {
    const res = await fetch(`${BASE_URL}${PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshToken,
        organization_id: activeOrg?.id ?? null,
      }),
    });
    if (!res.ok) {
      clearSession();
      return false;
    }
    const data = await res.json();
    setSession(
      { accessToken: data.access_token, refreshToken: data.refresh_token },
      {
        user_id: data.user?.user_id ?? "",
        email: data.user?.email ?? "",
        role: data.user?.role ?? "member",
        org_id: data.user?.org_id ?? activeOrg?.id ?? "",
      },
    );
    return true;
  } catch {
    clearSession();
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers: extraHeaders, idempotent = false, isFormData = false } = options;

  const { accessToken, clearSession } = useAuthStore.getState();
  const { activeOrg } = useOrgStore.getState();

  const headers: Record<string, string> = { ...extraHeaders };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (activeOrg?.id) {
    headers["X-Organization-Id"] = activeOrg.id;
  }
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  let idempotencyKey: string | undefined;
  if (idempotent && method !== "GET") {
    idempotencyKey = generateIdempotencyKey(path);
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res = await fetch(`${BASE_URL}${PREFIX}${path}`, fetchOptions);

  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
      }
      fetchOptions.headers = headers;
      res = await fetch(`${BASE_URL}${PREFIX}${path}`, fetchOptions);
    } else {
      clearSession();
      throw new ApiError(401, "Session expired. Please log in again.");
    }
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const detail = data && typeof data === "object" && "detail" in data
      ? String((data as { detail: unknown }).detail)
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }

  if (idempotencyKey) {
    markIdempotencyDone(idempotencyKey);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "GET", headers }),

  post: <T>(path: string, body?: unknown, opts?: { idempotent?: boolean; headers?: Record<string, string> }) =>
    request<T>(path, { method: "POST", body, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: { idempotent?: boolean; headers?: Record<string, string> }) =>
    request<T>(path, { method: "PATCH", body, ...opts }),

  del: <T>(path: string, opts?: { idempotent?: boolean; headers?: Record<string, string> }) =>
    request<T>(path, { method: "DELETE", ...opts }),

  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData, isFormData: true }),
};
