import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/cookies";

// Route guard (Next 16 renamed `middleware` -> `proxy`). Protected app pages live under /app/*. If there's no session
// cookie, bounce to /login; if a logged-in user hits an auth page, send them in.
const PROTECTED_PREFIX = "/app";
const AUTH_PAGES = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession =
    Boolean(req.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(req.cookies.get(REFRESH_COOKIE)?.value);

  if (pathname.startsWith(PROTECTED_PREFIX) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"],
};
