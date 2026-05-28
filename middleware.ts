import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_SECRET = 'letoile-secret-key-2026-signing'

// Version compatible Edge Runtime utilisant l'API Web Crypto standard
export async function verifySignature(cookieValue: string) {
  const [data, signature] = cookieValue.split('.')
  if (!data || !signature) return null

  try {
    // 1. Re-calcul de la signature attendue en Web Crypto HMAC SHA-256
    const encoder = new TextEncoder()
    const secretKeyData = encoder.encode(SESSION_SECRET)
    const sourceData = encoder.encode(data)

    const key = await crypto.subtle.importKey(
      "raw",
      secretKeyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, sourceData)
    
    // Encodage en base64 standard équivalent à digest('base64')
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

    if (signature !== expectedSignature) return null

    // 2. Décodage des données (Remplacement de Buffer par atob standard)
    const decoded = atob(data)
    return JSON.parse(decoded)
  } catch (e) {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('auth_session')
  const { pathname } = request.nextUrl

  // Logique des routes protégées
  const isLoginPage = pathname.startsWith('/login')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.includes('.')

  // 1. Vérification de l'authentification de base
  if (!sessionCookie && !isLoginPage && !isApiAuth && !isPublicAsset) {
    if (pathname.startsWith('/api')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (sessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 2. Application du RBAC avec vérification de la signature asynchrone
  if (sessionCookie) {
    const session = await verifySignature(sessionCookie.value)

    if (!session) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_session')
      return response
    }

    // Vérification de l'expiration du token
    if (session.exp < Date.now()) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_session')
      return response
    }

    const role = session.role?.toLowerCase() // Sécurité sur la casse (admin / user)

    // Définition des modules métiers opérationnels
    const isBusinessRoute = pathname.startsWith('/quotes') ||
                            pathname.startsWith('/invoices') ||
                            pathname.startsWith('/clients') ||
                            pathname.startsWith('/services')

    const isBusinessApi = pathname.startsWith('/api/quotes') ||
                          pathname.startsWith('/api/invoices') ||
                          pathname.startsWith('/api/clients') ||
                          pathname.startsWith('/api/services')

    // Définition des modules administratifs exclusifs
    const isAdminOnlyRoute = pathname.startsWith('/audit') || 
                             pathname.startsWith('/users') || 
                             pathname.startsWith('/settings') // Paramètres rajoutés
                             
    const isAdminOnlyApi = pathname.startsWith('/api/audit-logs') || 
                           pathname.startsWith('/api/users') || 
                           pathname.startsWith('/api/settings')

    // 🔒 RESTRICTIONS ADMIN : Interdiction d'accès aux modules métiers opérationnels
    if (role === 'admin') {
      if (isBusinessRoute) {
        return NextResponse.redirect(new URL('/?error=admin_restricted', request.url))
      }
      if (isBusinessApi) {
        return new NextResponse(JSON.stringify({ error: 'Accès interdit aux administrateurs' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
    }

    // 🔒 RESTRICTIONS USER : Interdiction d'accès aux modules administratifs
    if (role === 'user') {
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