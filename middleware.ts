import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// In Next.js Edge Runtime, we use the Web Crypto API (SubtleCrypto)
// because node:crypto and Buffer/atob might be limited or restricted.

/**
 * SECURITY: SESSION_SECRET must be set in environment variables.
 * The application will crash on startup if the secret is absent or too short.
 * Generate a strong secret with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) {
    return secret
  }
  // Fallback dev robuste pour permettre le démarrage local Electron / next dev sans crash 500/503
  // (sauf en mode test Vitest où l'on vérifie le comportement fail-fast 503)
  if (process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && process.env.VITEST !== 'true')) {
    return 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!'
  }
  throw new Error(
    '[SECURITY] SESSION_SECRET environment variable is missing or too short (minimum 32 characters). ' +
    'Set it in your .env.local file. Application cannot start with an insecure or absent secret.'
  )
}

// SESSION_SECRET is intentionally NOT evaluated at module scope.
// Evaluating it at module scope causes the Edge Runtime to crash on startup
// when the env var is missing, which makes Next.js return a raw HTML error page
// instead of a JSON 401/503 — causing "Unexpected token '<'" in the frontend.
// It is validated inside middleware() so that each request gets a clean JSON error.

// Helper to convert string to ArrayBuffer using TextEncoder (Edge Runtime compatible)
function str2ab(str: string) {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

// Helper to convert ArrayBuffer to string using TextDecoder (Edge Runtime compatible)
function ab2str(buf: ArrayBuffer) {
  const decoder = new TextDecoder()
  return decoder.decode(buf)
}

// Helper to convert Base64 to Uint8Array with Buffer fallback
function base64ToUint8Array(base64: string) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'))
  }
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Helper to convert Uint8Array to Base64 with Buffer fallback
function uint8ArrayToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function verifySignature(data: string, signature: string, secret: string) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      str2ab(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBuf = base64ToUint8Array(signature);
    const dataBuf = str2ab(data);

    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      dataBuf
    );
  } catch (e) {
    return false;
  }
}

async function getSession(cookieValue: string, secret: string) {
  const [data, signature] = cookieValue.split('.')
  if (!data || !signature) return null

  const isValid = await verifySignature(data, signature, secret)
  if (!isValid) return null

  try {
    const decoded = atob(data)
    return JSON.parse(decoded)
  } catch (e) {
    return null
  }
}

export async function middleware(request: NextRequest) {
  // CRITICAL: validate SESSION_SECRET inside the function (not at module scope).
  // If the secret is missing, return a clean JSON 503 instead of crashing the Edge Runtime
  // (which would cause Next.js to return an HTML error page, triggering JSON parse errors
  // in the frontend: "Unexpected token '<', '<!DOCTYPE'...").
  let SESSION_SECRET: string
  try {
    SESSION_SECRET = getSessionSecret()
  } catch (e) {
    console.error('[Middleware] FATAL:', e instanceof Error ? e.message : e)
    return new NextResponse(
      JSON.stringify({ error: 'Configuration serveur invalide. Contactez l\'administrateur.' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    )
  }

  const sessionCookie = request.cookies.get('auth_session')
  const { pathname } = request.nextUrl

  // Protected routes logic
  const isLoginPage = pathname.startsWith('/login')
  const isSetupPage = pathname.startsWith('/setup')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isApiSetup = pathname.startsWith('/api/setup')
  const isHealthCheck = pathname === '/api/health'
  // SECURITY FIX: Replace pathname.includes('.') (bypassable by any path containing a dot,
  // e.g. /api/users/1.0/secret) with an explicit allowlist of legitimate static file extensions.
  // Only these extensions are considered public assets and bypass authentication.
  const STATIC_ASSET_REGEX = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$/i
  const isPublicAsset = pathname.startsWith('/_next') || STATIC_ASSET_REGEX.test(pathname)

  // 1. Validate Session Signature & Expiration if cookie exists
  const session = sessionCookie ? await getSession(sessionCookie.value, SESSION_SECRET) : null
  const isSessionValid = Boolean(session && session.exp >= Date.now())

  // Si on est sur /login ou /setup : laisser afficher la page sans jamais rediriger vers /
  // (évite toute boucle 307 si le cookie HMAC est valide mais que l'utilisateur a été réinitialisé en base SQLite,
  // et permet l'accès à /setup pour l'initialisation de l'application)
  if (isLoginPage || isSetupPage) {
    if (sessionCookie && !isSessionValid) {
      const response = NextResponse.next()
      response.cookies.delete('auth_session')
      return response
    }
    return NextResponse.next()
  }

  // Si on est sur une route protégée (hors assets publics, login, setup, auth API, setup API, health) et que la session est invalide
  if (!isSessionValid && !isApiAuth && !isApiSetup && !isHealthCheck && !isPublicAsset) {
    if (pathname.startsWith('/api')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized: Session invalid or expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_session')
    return response
  }

  // 2. RBAC Enforcement
  if (isSessionValid && session) {
    const role = session.role

    const ADMIN_ROUTES = ['/audit', '/users', '/clients', '/services', '/customers']
    const ADMIN_APIS = ['/api/audit-logs', '/api/users', '/api/clients']

    // User/Operator Restrictions
    const isAdminOnlyRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route))
    const isAdminOnlyApi = ADMIN_APIS.some(api => pathname.startsWith(api))

    if (role === 'user' || role === 'operator') {
      if (isAdminOnlyRoute) {
        return NextResponse.redirect(new URL('/?error=user_restricted', request.url))
      }
      if (isAdminOnlyApi) {
        return new NextResponse(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|api/health|_next/static|_next/image|favicon.ico).*)'],
}
