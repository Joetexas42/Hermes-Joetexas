import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken, authRequired } from "@/lib/auth";

/**
 * Auth gate. Active only when AGENTIC_OS_PASSWORD env var is set
 * (i.e. on the VPS deployment; localhost dev runs unauthenticated).
 *
 * Allowlisted paths: /login, /api/auth, static assets.
 */
export const config = {
  matcher: [
    // Everything except _next/static, favicon, /login, /api/auth
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};

export function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (verifyToken(token)) return NextResponse.next();

  // Redirect HTML page requests to /login; reject API requests with 401
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (isApi) {
    return new NextResponse(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
