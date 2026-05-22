import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/request'

export function proxy(request: any) {
  const session = request.cookies.get('auth_session')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth')

  if (!session && !isLoginPage && !isApiAuth && !request.nextUrl.pathname.startsWith('/_next')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
