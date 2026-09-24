import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Gates the whole app behind a signed-in user (src/app/login,
 * src/lib/actions/auth.ts). Only verifies the session cookie's signature
 * here (no DB call — Proxy runs on every route, including prefetches, so
 * this stays a fast, "optimistic" check per Next.js's own auth guidance);
 * pages that need the actual user record call getCurrentUser().
 *
 * /api/health is excluded so the Docker healthcheck (which sends no
 * cookies) keeps working, and /login is excluded so there's somewhere to
 * sign in from.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/health") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
