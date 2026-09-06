import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Récupère le secret de session depuis les variables d'environnement.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "development" || process.env.VITEST === "true") {
    return "facturier-gabon-2026-fallback-dev-secret-key-32chars!!";
  }
  throw new Error("[SECURITY] SESSION_SECRET environment variable is missing or too short.");
}

function str2ab(str: string) {
  return new TextEncoder().encode(str);
}

function base64ToUint8Array(base64: string) {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function verifySignature(data: string, signature: string, secret: string) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      str2ab(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify("HMAC", key, base64ToUint8Array(signature), str2ab(data));
  } catch {
    return false;
  }
}

async function getSession(cookieValue: string, secret: string) {
  const [data, signature] = cookieValue.split(".");
  if (!data || !signature) return null;
  if (!(await verifySignature(data, signature, secret))) return null;
  try {
    return JSON.parse(atob(data));
  } catch {
    return null;
  }
}

const PUBLIC_ROUTES = ["/login", "/setup"];
const PUBLIC_API_ROUTES = ["/api/auth", "/api/setup", "/api/health"];
const ADMIN_API_ROUTES = ["/api/audit-logs", "/api/users", "/api/clients"];
const STATIC_ASSET_REGEX = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let SESSION_SECRET: string;
  try {
    SESSION_SECRET = getSessionSecret();
  } catch (e) {
    if (pathname.startsWith("/api/") || pathname === "/api") {
        return new NextResponse(JSON.stringify({ error: "Configuration serveur invalide." }), { status: 503, headers: { "content-type": "application/json" } });
    }
    // L'idéal est de ne pas crasher le layout
    SESSION_SECRET = "";
  }

  const sessionCookie = request.cookies.get("auth_session");
  const isApiRequest = pathname.startsWith("/api/") || pathname === "/api";
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
  const isPublicApi = PUBLIC_API_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
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
    const isAdminOnlyApi = ADMIN_API_ROUTES.some(api => pathname === api || pathname.startsWith(api + "/"));
    if (session.role !== "admin" && isAdminOnlyApi) {
      return new NextResponse(JSON.stringify({ error: "Accès réservé aux administrateurs" }), { status: 403, headers: { "content-type": "application/json" } });
    }
  }

  // Note: La redirection pour ADMIN_FRONTEND_ROUTES a été retirée pour respecter le Visual RBAC Pattern.
  // Les composants frontend devront gérer l'état `disabled` selon le rôle.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
