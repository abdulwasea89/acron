// Server-only session helpers. Auth tokens are stored in httpOnly cookies so
// they are never exposed to client-side JavaScript (XSS-safe). Only Next.js
// server code (route handlers, server components) can read them.
import { cookies } from "next/headers";
import { ACCESS_COOKIE, ORG_COOKIE, REFRESH_COOKIE } from "./cookies";

export { ACCESS_COOKIE, ORG_COOKIE, REFRESH_COOKIE };

const secure = process.env.COOKIE_SECURE === "1";

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  organization_id?: string | null;
}

/** Persist tokens after a successful login/refresh. */
export async function setSession(tokens: SessionTokens): Promise<void> {
  const jar = await cookies();
  const base = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
  // Access token: short-lived (matches backend 15-min access token).
  jar.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: 60 * 15 });
  // Refresh token: 7 days (backend default).
  jar.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: 60 * 60 * 24 * 7 });
  if (tokens.organization_id) {
    jar.set(ORG_COOKIE, tokens.organization_id, { ...base, maxAge: 60 * 60 * 24 * 7 });
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ORG_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function getOrgId(): Promise<string | undefined> {
  return (await cookies()).get(ORG_COOKIE)?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(ACCESS_COOKIE)?.value || jar.get(REFRESH_COOKIE)?.value);
}
