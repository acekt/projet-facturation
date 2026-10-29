import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionSecret, getSession } from "@/lib/api/auth";

// Publicly accessible application routes (no authentication required)
const PUBLIC_ROUTES: string[] = ["/login", "/setup"];

// Publicly accessible API routes (no authentication required)
const PUBLIC_API_ROUTES: string[] = ["/api/auth", "/api/setup", "/api/health"];

// Admin-only API routes (Operator role will be rejected with 403 Forbidden)
const ADMIN_API_ROUTES: string[] = ["/api/audit-logs", "/api/users", "/api/clients"];

// Admin-only Frontend routes (Operator role will be rejected with 403 Forbidden)
const ADMIN_FRONTEND_ROUTES: string[] = ["/audit-logs", "/users", "/clients", "/settings"];

const STATIC_ASSET_REGEX: RegExp = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$/i;

const matchRoute = (pathname: string, routes: string[]) => {
  return routes.some(r => pathname === r || pathname.startsWith(r + "/"));
};

/**
 * Next.js 16 Proxy convention (Lot K4 / P8).
 * L'endpoint /api/health reste impérativement exempté pour le splash screen Electron (ADR-0022).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // L'endpoint de santé du splash screen Electron ne doit JAMAIS être bloqué par les secrets de session
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  let SESSION_SECRET: string;
  try {
    SESSION_SECRET = getSessionSecret();
  } catch {
    if (pathname.startsWith("/api/") || pathname === "/api") {
      return new NextResponse(JSON.stringify({ error: "Configuration serveur invalide." }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
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
      return new NextResponse(JSON.stringify({ error: "Unauthorized: Session invalid or expired" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth_session");
    return response;
  }

  // Contrôle RBAC (Role-Based Access Control)
  if (isSessionValid && session) {
    if (isApiRequest) {
      const isAdminOnlyApi = matchRoute(pathname, ADMIN_API_ROUTES);
      if (session.role !== "admin" && isAdminOnlyApi) {
        return new NextResponse(JSON.stringify({ error: "Accès réservé aux administrateurs" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
    } else if (!isPublicAsset) {
      const isAdminOnlyRoute = matchRoute(pathname, ADMIN_FRONTEND_ROUTES);
      if (session.role !== "admin" && isAdminOnlyRoute) {
        return NextResponse.redirect(new URL("/?error=forbidden", request.url));
      }
    }
  }

  return NextResponse.next();
}

// Alias pour rétrocompatibilité
export const middleware = proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
