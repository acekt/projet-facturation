import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getSession } from '@/lib/api/auth'
import db from '@/lib/db'
import { ProtectedAppShell } from '@/components/pages/protected-app-shell'
import type { UserResponse } from '@/lib/types/api'

export const instant = false;

/**
 * Contenu authentifié — logique asynchrone dynamique (requête entrante requise).
 * Vérifie l'intégrité de la session (HMAC) et la présence effective
 * de l'utilisateur dans la base SQLite avant tout rendu HTML.
 * En cas de session absente ou invalide, émet une redirection vers /login.
 */
async function AuthenticatedAppContent() {
  await connection()
  const session = await getSession()
  if (!session || !session.userId) {
    redirect('/login')
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND deletedAt IS NULL').get(session.userId) as any
  if (!user || user.is_active === 0) {
    redirect('/login')
  }

  // Interdiction formelle du superadmin sur le Desktop (réservé au Web Hub Cloud)
  const roleLower = (user.role || '').toLowerCase().trim();
  const emailLower = (user.email || '').toLowerCase().trim();
  if (roleLower === 'superadmin' || roleLower === 'super_admin' || emailLower.includes('superadmin')) {
    redirect('/login?error=forbidden')
  }

  const initialUser: UserResponse = {
    id: user.id,
    name: user.name,
    role: user.role as 'admin' | 'user',
    email: user.email || '',
    username: user.username,
    is_active: user.is_active,
    force_password_change: user.force_password_change ? 1 : 0,
    created_at: user.created_at,
    tenant_id: user.tenant_id || undefined,
  }

  return <ProtectedAppShell initialUser={initialUser} />
}

/**
 * Server Component Protecteur — Racine de l'application (/)
 * La partie dynamique est isolée dans <Suspense> pour ne pas bloquer le prérendu.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthenticatedAppContent />
    </Suspense>
  )
}
