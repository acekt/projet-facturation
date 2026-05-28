import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

const SESSION_SECRET = 'letoile-secret-key-2026-signing'

function verifySignature(cookieValue: string) {
  const [data, signature] = cookieValue.split('.')
  if (!data || !signature) return null

  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64')

  if (signature !== expectedSignature) return null

  try {
    const decoded = Buffer.from(data, 'base64').toString()
    return JSON.parse(decoded)
  } catch (e) {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('auth_session')
  const { pathname } = request.nextUrl

  // Protected routes logic
  const isLoginPage = pathname.startsWith('/login')
  const isApiAuth = pathname.startsWith('/api/auth')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.includes('.')

  // 1. Check Authentication
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

  // 2. RBAC Enforcement with Signature Verification
  if (sessionCookie) {
    const session = verifySignature(sessionCookie.value)

    if (!session) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_session')
      return response
    }

    // Check expiration
    if (session.exp < Date.now()) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_session')
      return response
    }

    const role = session.role

    // Business routes
    const isBusinessRoute = pathname.startsWith('/quotes') ||
                            pathname.startsWith('/invoices') ||
                            pathname.startsWith('/clients') ||
                            pathname.startsWith('/services')

    const isBusinessApi = pathname.startsWith('/api/quotes') ||
                          pathname.startsWith('/api/invoices') ||
                          pathname.startsWith('/api/clients') ||
                          pathname.startsWith('/api/services')

    // Admin Restrictions
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

    // User Restrictions
    const isAdminOnlyRoute = pathname.startsWith('/audit') || pathname.startsWith('/users')
    const isAdminOnlyApi = pathname.startsWith('/api/audit-logs') || pathname.startsWith('/api/users')

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
