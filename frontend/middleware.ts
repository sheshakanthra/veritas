import { NextResponse, type NextRequest } from "next/server";

// Must match AUTH_COOKIE_NAME in backend/app/services/auth.py.
const AUTH_COOKIE_NAME = "veritas_token";

const AUTH_PAGES = ["/login", "/signup"];

/**
 * Presence-based gating only: the middleware cannot verify the JWT
 * signature (the secret lives backend-side), so a stale cookie gets
 * through here and the backend's 401 is the real enforcement.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(AUTH_COOKIE_NAME);
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/analyze/:path*", "/login", "/signup"],
};
