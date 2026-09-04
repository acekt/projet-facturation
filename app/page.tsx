import React from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/api/auth'
import db from '@/lib/db'
import { ProtectedAppShell } from '@/components/pages/protected-app-shell'

export const dynamic = 'force-dynamic';

import type { UserResponse } from '@/lib/types/api'

/**
 * Server Component Protecteur — Racine de l'application (/)
 * ==========================================================
 * Vérifie l'intégrité de la session (HMAC) et la présence effective
 * de l'utilisateur dans la base SQLite avant tout rendu HTML.
 * En cas de session absente ou invalide, émet immédiatement une
 * redirection HTTP stricte (307) vers /login sans monter de composant client.
 */
export default async function Page() {
  const session = await getSession()
  if (!session || !session.userId) {
    redirect('/login')
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any
  if (!user) {
    redirect('/login')
  }

  const initialUser: UserResponse = {
    id: user.id,
    name: user.name,
    role: user.role as 'admin' | 'user',
    email: user.email || '',
    username: user.username,
    is_active: user.is_active,
    created_at: user.created_at
  }

  return <ProtectedAppShell initialUser={initialUser} />
}
