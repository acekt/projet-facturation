import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Récupère le secret de session depuis les variables d'environnement.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) {
    return secret
  }
  if (process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && process.env.VITEST !== 'true')) {
    return 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!'
  }
  throw new Error(
    '[SECURITY] SESSION_SECRET environment variable is missing or too short (minimum 32 characters).'
  )
}

function str2ab(str: string) {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

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
    return await crypto.subtle.verify('HMAC', key, sigBuf, dataBuf);
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

// Configuration des routes
const PUBLIC_ROUTES = ['/login', '/setup']
const PUBLIC_API_ROUTES = ['/api/auth', '/api/setup', '/api/health']
const ADMIN_API_ROUTES = ['/api/audit-logs', '/api/users', '/api/clients']
const ADMIN_FRONTEND_ROUTES = ['/audit', '/users', '/clients', '/services', '/customers']
const STATIC_ASSET_REGEX = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$/i

export async function middleware(request: NextRequest) {
  let SESSION_SECRET: string
  try {
    SESSION_SECRET = getSessionSecret()
  } catch (e) {
    return new NextResponse(
      JSON.stringify({ error: 'Configuration serveur invalide. Contactez l\'administrateur.' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    )
  }

  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('auth_session')

  // Helpers pour les routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  const isPublicApi = PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  const isPublicAsset = pathname.startsWith('/_next') || (STATIC_ASSET_REGEX.test(pathname) && !pathname.startsWith('/api'))

  // Validation de la session
  const session = sessionCookie ? await getSession(sessionCookie.value, SESSION_SECRET) : null
  const isSessionValid = Boolean(session && session.exp >= Date.now())

  // Gestion des routes publiques
  if (isPublicRoute) {
    if (sessionCookie && !isSessionValid) {
      const response = NextResponse.next()
      response.cookies.delete('auth_session')
      return response
    }
    return NextResponse.next()
  }

  // Redirection si non authentifié sur une route protégée
  if (!isSessionValid && !isPublicApi && !isPublicAsset) {
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

  // Contrôle RBAC (Role-Based Access Control)
  if (isSessionValid && session) {
    const role = session.role
    const isApiRequest = pathname.startsWith('/api')

    const isAdminOnlyRoute = ADMIN_FRONTEND_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
    const isAdminOnlyApi = ADMIN_API_ROUTES.some(api => pathname === api || pathname.startsWith(api + '/'))

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
