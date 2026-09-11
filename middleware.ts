import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionSecret, getSession } from "@/lib/api/auth";

// Publicly accessible application routes (no authentication required)
const PUBLIC_ROUTES: string[] = ["/login", "/setup"];

// Publicly accessible API routes (no authentication required)
const PUBLIC_API_ROUTES: string[] = ["/api/auth", "/api/setup", "/api/health"];

// Admin-only API routes (Operator role will be rejected with 403 Forbidden)
const ADMIN_API_ROUTES: string[] = ["/api/audit-logs", "/api/users", "/api/clients"];

const STATIC_ASSET_REGEX: RegExp = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$/i;

const matchRoute = (pathname: string, routes: string[]) => {
  return routes.some(r => pathname === r || pathname.startsWith(r + "/"));
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let SESSION_SECRET: string;
  try {
    SESSION_SECRET = getSessionSecret();
  } catch (e) {
    if (pathname.startsWith("/api/") || pathname === "/api") {
        return new NextResponse(JSON.stringify({ error: "Configuration serveur invalide." }), { status: 503, headers: { "content-type": "application/json" } });
    }
    SESSION_SECRET = "";
  }

  const sessionCookie = request.cookies.get("auth_session");
  const isApiRequest = pathname.startsWith("/api/") || pathname === "/api";
  const isPublicRoute = matchRoute(pathname, PUBLIC_ROUTES);
  const isPublicApi = matchRoute(pathname, PUBLIC_API_ROUTES);
  const isPublicAsset = pathname.startsWith("/_next") || (STATIC_ASSET_REGEX.test(pathname) && !isApiRequest);

  const session = sessionCookie && SESSION_SECRET ? await getSession(sessionCookie.value, SESSION_SECRET) : null;
  const isSessionValid = Boolean(session && session.exp >= Date.now());

  if (isPublicRoute) {
    if (sessionCookie && !isSessionValid) {
      const response = NextResponse.next();
      response.cookies.delete("auth_session");
      return response;
    }
    if (isSessionValid) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!isSessionValid && !isPublicApi && !isPublicAsset) {
    if (isApiRequest) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized: Session invalid or expired" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth_session");
    return response;
  }

  if (isSessionValid && session && isApiRequest) {
    const isAdminOnlyApi = matchRoute(pathname, ADMIN_API_ROUTES);
    if (session.role !== "admin" && isAdminOnlyApi) {
      return new NextResponse(JSON.stringify({ error: "Accès réservé aux administrateurs" }), { status: 403, headers: { "content-type": "application/json" } });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
