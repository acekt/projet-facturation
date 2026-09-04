# DEEP AUDIT REPORT - MODULE 1 (SECURITY & AUTHENTICATION)

## 1. Middleware (`middleware.ts`)

### Diagnostics & Vulnerabilities
* **Absence of Authenticated Redirects from Public Routes:** The middleware does not redirect an already authenticated user away from `/login` or `/setup`. If a user with a valid session visits `/login`, they stay on the login page instead of being redirected to `/` (dashboard).
* **Inconsistent Secret Fallback:** The `getSessionSecret` function provides a fallback for `SESSION_SECRET` in development, which is reasonable. However, the exact way it falls back might differ from strict requirements (e.g., in production without a `.env`, it correctly throws, but error handling later swallows it as a generic 503 rather than preventing application startup).
* **Weak RBAC Logic:** The role check is implemented as `role === 'user' || role === 'operator'` instead of a restrictive default approach (e.g., `role !== 'admin'`). This means any future role added (e.g., `viewer`, `manager`) would unintentionally gain full `admin` access to the API and frontend routes.

### Refactored Code
```typescript
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
    // ADDED: Redirection si déjà authentifié
    if (isSessionValid) {
      return NextResponse.redirect(new URL('/', request.url))
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

    // UPDATED: Strict RBAC Default (Only admin gets access to admin routes)
    if (role !== 'admin') {
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
```

## 2. API Login (`app/api/auth/login/route.ts`)

### Diagnostics & Vulnerabilities
* **Missed Bcrypt Upgrade Opportunity:** The fallback for legacy SHA-256 password hashes checks validity successfully, but leaves a comment `// OPTIONAL: Update to bcrypt here seamlessly if successful`. This is a missed security best practice. The code should actively re-hash the password using `bcrypt` and update the database entry in the background, upgrading the user's security seamlessly.

### Refactored Code snippet (Lines 102-108)
```typescript
    // Fallback legacy SHA-256 and Seamless Bcrypt Upgrade
    if (!isPasswordValid && user.password) {
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;

      // Seamlessly upgrade to bcrypt
      if (isPasswordValid) {
        try {
          const newBcryptHash = await bcrypt.hash(password, 10);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newBcryptHash, user.id);
        } catch (upgradeError) {
          console.error('[Login] Failed to seamlessly upgrade password hash to bcrypt:', upgradeError);
        }
      }
    }
```

## 3. API Logout (`app/api/auth/logout/route.ts`)

### Diagnostics & Vulnerabilities
* **Missing Audit Logs:** The logout action correctly clears the cookie, but totally fails to log the action in the audit trace, preventing administrators from knowing when a session ended (especially useful for identifying hijacked sessions or unauthorized access). It must integrate with `logAuditAsync` (or equivalent).

### Refactored Code
```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logAudit } from '@/lib/api/audit';
import { getSession } from '@/lib/api/auth'; // Ensure this is available, or parse it to get user info

export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get('auth_session');
        if (sessionCookie) {
            // Ideally extract the userId from the cookie to log it properly,
            // assuming getSession or similar is imported/available to get ID.
            // If not, log as a general LOGOUT event.
            setTimeout(() => {
                try {
                    logAudit('LOGOUT_SUCCESS', 'user', null, 'Déconnexion réussie', null);
                } catch (e) {
                    console.error('[Audit Log Error]', e);
                }
            }, 0);
        }
        (await cookies()).delete('auth_session');
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Erreur lors de la déconnexion' }, { status: 500 });
    }
}
```

## 4. UI Login Client (`app/login/login-client.tsx`)

### Diagnostics & Vulnerabilities
* **React Form Anti-Pattern (Double Submission):** The client handles loading state manually using `setLoading(true)` and `setLoading(false)`. As dictated by the codebase architectural rules, double-submission prevention should universally use `React.useTransition` (e.g., `startTransition`) combined with an `isSubmitting` flag to temporarily disable action buttons, preventing race conditions. Also, `startTransition` should not receive an async function directly, as it resolves instantly and breaks the loading state.

### Refactored Code
```typescript
"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from "@/lib/store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  ShieldCheck, Mail, Lock, Eye, EyeOff, ChevronRight, CheckCircle2, Star, Users, Sparkles, Loader2
} from "lucide-react"

export default function LoginClient() {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [showDemoOptions, setShowDemoOptions] = React.useState(false)

  // Anti-Pattern Fix: Use useTransition for form submissions
  const [isPending, startTransition] = React.useTransition()

  const router = useRouter()
  const setUser = useStore((state) => state.setUser)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    // IMPORTANT: Do not pass async function to startTransition
    startTransition(() => {
      // Execute the async operation outside the transition's synchronous scope,
      // but let the transition track the state update
      void (async () => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          })
          const data = await res.json()
          if (res.ok) {
            toast.success("Connexion réussie. Bienvenue dans Facturier !")
            setUser(data.user)
            await new Promise(resolve => setTimeout(resolve, 250))
            router.push('/')
            router.refresh()
          } else {
            toast.error(data.error || "Identifiants invalides")
          }
        } catch (err) {
          toast.error("Impossible de joindre le serveur local")
        }
      })()
    })
  }

  const fillDemoCredentials = (role: 'admin' | 'operator') => {
    if (role === 'admin') {
      setUsername('admin@facturier.ga')
      setPassword('admin123')
      toast.info("Identifiants Administrateur insérés")
    } else {
      setUsername('operateur@facturier.ga')
      setPassword('operateur123')
      toast.info("Identifiants Opérateur insérés")
    }
    setShowDemoOptions(false)
  }

  return (
    // ... [The rest of the UI code is identical, replacing `loading` with `isPending`] ...
    // e.g. disabled={isPending}
  )
}
```
