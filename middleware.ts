import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// In Next.js Edge Runtime, we use the Web Crypto API (SubtleCrypto)
// because node:crypto and Buffer/atob might be limited or restricted.

const SESSION_SECRET = process.env.SESSION_SECRET || 'letoile-secret-key-2026-signing'

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

async function verifySignature(data: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      str2ab(SESSION_SECRET),
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

async function getSession(cookieValue: string) {
  const [data, signature] = cookieValue.split('.')
  if (!data || !signature) return null

  const isValid = await verifySignature(data, signature)
  if (!isValid) return null

  try {
    const decoded = atob(data)
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

  // Allow read-only access to GET requests on quotes/invoices/services/clients APIs
  const isReadOnlyApi = (pathname.startsWith('/api/quotes') ||
                         pathname.startsWith('/api/invoices') ||
                         pathname.startsWith('/api/services') ||
                         pathname.startsWith('/api/clients')) &&
                        request.method === 'GET'

  // 1. Check Authentication
  if (!sessionCookie && !isLoginPage && !isApiAuth && !isPublicAsset && !isReadOnlyApi) {
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

  // 2. RBAC Enforcement
  if (sessionCookie) {
    const session = await getSession(sessionCookie.value)

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
                            pathname.startsWith('/customers') ||
                            pathname.startsWith('/services')

    const isBusinessApi = pathname.startsWith('/api/quotes') ||
                          pathname.startsWith('/api/invoices') ||
                          pathname.startsWith('/api/customers') ||
                          pathname.startsWith('/api/services')

    // Admin Restrictions - Admins can access everything
    if (role === 'admin') {
      // Admins have full access, no restrictions
    }

    // User/Operator Restrictions
    const isAdminOnlyRoute = pathname.startsWith('/audit') || pathname.startsWith('/users')
    const isAdminOnlyApi = pathname.startsWith('/api/audit-logs') || pathname.startsWith('/api/users')

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
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
