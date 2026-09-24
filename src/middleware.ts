import { NextResponse, type NextRequest } from "next/server";

/**
 * Gates the whole app behind HTTP Basic Auth (a single shared username +
 * password) when BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD are both set.
 * Local dev stays frictionless unless you opt in by setting them.
 *
 * The Docker healthcheck hits /api/health with no credentials, so that
 * route is excluded via the matcher below — never gate it, or the
 * container reports unhealthy and gets restarted in a loop.
 */
export function middleware(request: NextRequest) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, separatorIndex);
    const suppliedPass = decoded.slice(separatorIndex + 1);
    if (suppliedUser === username && suppliedPass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kusi Safaris Rates & Quotes"' },
  });
}

export const config = {
  matcher: ["/((?!api/health).*)"],
};
