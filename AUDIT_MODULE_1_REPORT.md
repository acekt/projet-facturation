# DIAGNOSTIC & REFACTORING REPORT: SÉCURITÉ & AUTHENTIFICATION (MODULE 1/5)

Ce document présente l'audit approfondi et les correctifs proposés pour le système d'authentification et de sécurité du projet "Facturier". Conformément à la directive système, aucun code source n'a été directement modifié, les propositions de remédiation sont fournies ci-dessous.

## 1. Analyse du Middleware (`middleware.ts`)

### ⚠️ Faille et Limites Identifiées :
- **Protection des routes RBAC par `startsWith`** : La vérification `pathname.startsWith('/api/users')` est vulnérable à des contournements. Si un utilisateur accède à `/api/users-public` ou `app/api/users123`, le middleware bloquerait la requête de façon non intentionnelle. Idéalement il faut tester l'exactitude de la route ou utiliser une regex plus stricte.
- **Gestion des extensions de fichiers statiques** : Bien que corrigé partiellement avec une regex pour bypasser l'authentification sur les assets statiques, il faut s'assurer que les requêtes vers d'autres endpoints API ne peuvent pas simuler une extension (ex: `/api/users/1.json`). La vérification `pathname.startsWith('/api')` doit avoir la priorité sur la vérification des assets statiques.
- **Lisibilité et maintenabilité** : La logique du middleware est monolithique. L'utilisation d'un objet de configuration avec des tableaux pour définir les routes publiques et protégées permettrait de simplifier la maintenance.
- **Vérification du secret** : L'utilisation de `try/catch` de base est fonctionnelle mais l'ensemble du middleware pourrait retourner une erreur plus générique en 500 si la vérification échoue de façon non prévue.

### ✅ Code Refactorisé (`middleware.ts`) :

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
```

## 2. Logique de Session & API d'authentification (`app/api/auth/login/route.ts`)

### ⚠️ Faille et Limites Identifiées :
- **Traces d'Audit (Performance)** : L'utilisation de `setTimeout(() => { logAudit(...) }, 0)` pour éviter de bloquer le thread principal est une bonne pratique, mais les exceptions `try/catch` encapsulées manquent parfois de typage explicite et d'un traitement d'erreur standardisé.
- **Vérification de mot de passe (Fail-back Legacy)** : Si le mot de passe correspond à un hachage SHA-256 legacy, il devrait idéalement être ré-haché en bcrypt à la volée. Bien que ce soit une évolution fonctionnelle, le fallback actuel fait le job mais devrait être documenté comme "A REMPLACER" à terme.
- **Réponse HTTP en dur** : Les données retournées sont adéquates, mais les imports et types pourraient être mieux groupés.

### ✅ Code Refactorisé (`app/api/auth/login/route.ts`) :

```typescript
import { NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { loginSchema } from '@/lib/validations';
import type { LoginRequest, SessionResponse, ErrorResponse, DbUser } from '@/lib/types/api';
import { logAudit } from '@/lib/api/audit';
import bcrypt from 'bcryptjs';

/**
 * Assure la présence et la longueur minimale d'une variable d'environnement critique.
 */
function getRequiredEnv(varName: string, minLength: number = 16): string {
  const value = process.env[varName];
  if (!value || value.length < minLength) {
    throw new Error(
      `[SECURITY] Environment variable '${varName}' is missing or too short (minimum ${minLength} characters).`
    );
  }
  return value;
}

function hashPassword(password: string): string {
  const salt = getRequiredEnv('PASSWORD_SALT', 16);
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function signSession(data: string): Promise<string> {
  const secret = getRequiredEnv('SESSION_SECRET', 32);
  const key = await crypto.webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.webcrypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${base64Signature}`;
}

/**
 * Helper asynchrone pour les logs d'audit non-bloquants
 */
const logAuditAsync = (action: string, entityType: string, entityId: string | null, details: string, userId: string | null, userName?: string | null) => {
  setTimeout(() => {
    try {
      logAudit(action, entityType, entityId, details, userId, userName);
    } catch (e) {
      console.error('[Audit Log Error]', e);
    }
  }, 0);
};

export async function POST(request: Request) {
  try {
    try {
      getRequiredEnv('PASSWORD_SALT', 16);
      getRequiredEnv('SESSION_SECRET', 32);
    } catch (configError) {
      return NextResponse.json({ error: "Configuration serveur invalide. Contactez l'administrateur." } as ErrorResponse, { status: 503 });
    }

    const body: unknown = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Données de connexion invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      } as ErrorResponse, { status: 400 });
    }

    const { username, password }: LoginRequest = validation.data;
    const cleanUsername = username.toLowerCase().trim();

    const user = db.prepare(`
      SELECT id, name, email, username, password, role, is_active, force_password_change, created_at, last_login_at, phone
      FROM users
      WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND deletedAt IS NULL
    `).get(cleanUsername, cleanUsername) as DbUser | undefined;

    if (!user) {
      logAuditAsync('LOGIN_FAILED', 'user', null, 'Tentative de connexion échouée avec: ' + cleanUsername, null);
      return NextResponse.json({ error: 'Identifiants invalides' } as ErrorResponse, { status: 401 });
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (e) {
      isPasswordValid = false;
    }

    // Fallback legacy SHA-256
    if (!isPasswordValid && user.password) {
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;

      // OPTIONAL: Update to bcrypt here seamlessly if successful
    }

    if (!isPasswordValid) {
      logAuditAsync('LOGIN_FAILED', 'user', user.id, 'Tentative de connexion échouée (mauvais mot de passe) pour: ' + cleanUsername, user.id, user.name);
      return NextResponse.json({ error: 'Identifiants invalides' } as ErrorResponse, { status: 401 });
    }

    if (user.is_active === 0) {
      return NextResponse.json({ error: 'Compte inactif. Veuillez contacter votre administrateur.' } as ErrorResponse, { status: 403 });
    }

    try {
      UserRepository.updateLastLogin(user.id);
    } catch (e) {
      console.error('[Login] Failed to update last_login_at:', e);
    }

    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    });

    const base64Data = Buffer.from(sessionData).toString('base64');
    const signedSession = await signSession(base64Data);

    const sessionPayload: SessionResponse = {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        phone: user.phone,
      },
    };

    logAuditAsync('LOGIN_SUCCESS', 'user', user.id, 'Connexion réussie', user.id, user.name);

    const response = NextResponse.json(sessionPayload);

    // Cookie NextResponse
    response.cookies.set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Cookie next/headers for RSC context
    try {
      (await cookies()).set('auth_session', signedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
    } catch (e) {
      // Ignore outside request scope
    }

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' } as ErrorResponse, { status: 500 });
  }
}
```

## 3. UI/UX: Layout Racine (`app/layout.tsx`) et Client Login (`app/login/login-client.tsx`)

### ⚠️ Observations :
- Le layout `app/layout.tsx` est déjà très bien optimisé pour une app Electron (suppression d'analytics, typographie hors-ligne). La logique de thème via le script injecté prévient efficacement le FOUC (Flash of Unstyled Content).
- La page `login-client.tsx` gère proprement les états de chargement (`disabled={loading}`) avec des spinners clairs et un feedback utilisateur (Toasts), ainsi que la gestion de session (redirection rapide après authentification).
- Le design utilisant Tailwind est premium et intègre de bons contrastes, mais assurez-vous que les icônes (ex. `Loader2`) viennent d'une source packagée (`lucide-react`) plutôt que via un CDN pour garantir un fonctionnement hors-ligne.

### ✅ Amélioration UX globale (Aucun changement majeur de code requis) :
L'interface de la page de login gère déjà parfaitement :
- L'état `loading` pendant la résolution réseau (`fetch`).
- Le masquage/affichage du mot de passe en un clic.
- La remontée de messages d'erreur depuis l'API.

Toutefois, lors du rendu du composant, il faut s'assurer que si le cookie expire et redirige, le paramètre `?error=` de l'URL est intercepté et affiché via un `toast.error` au montage (ex: `useEffect` dans `login-client.tsx`).
