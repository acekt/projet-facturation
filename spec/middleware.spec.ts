import { describe, it, expect, vi } from 'vitest'
import { middleware, verifySignature } from '@/middleware'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_SECRET = 'letoile-secret-key-2026-signing'

// Helper de signature de token cryptographique pour les tests
async function generateTestCookie(session: any) {
  const data = btoa(JSON.stringify(session))
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
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
  return `${data}.${signature}`
}

describe('Sécurité RBAC et Middleware', () => {
  it('verifySignature devrait accepter un cookie authentique', async () => {
    const session = { username: 'user1', role: 'user', exp: Date.now() + 3600000 }
    const cookieValue = await generateTestCookie(session)
    
    const decoded = await verifySignature(cookieValue)
    expect(decoded).not.toBeNull()
    expect(decoded?.username).toBe('user1')
    expect(decoded?.role).toBe('user')
  })

  it('verifySignature devrait rejeter un cookie falsifié', async () => {
    const session = { username: 'user1', role: 'user', exp: Date.now() + 3600000 }
    const cookieValue = await generateTestCookie(session)
    
    // Altération de la signature du cookie
    const falsifiedCookie = cookieValue + 'invalid'
    const decoded = await verifySignature(falsifiedCookie)
    expect(decoded).toBeNull()
  })

  it('middleware devrait bloquer un utilisateur de rôle USER accédant aux pages admin', async () => {
    const session = { username: 'user1', role: 'user', exp: Date.now() + 3600000 }
    const cookieValue = await generateTestCookie(session)

    // L'utilisateur tente d'accéder à la page admin /audit
    const request = new NextRequest('http://localhost:3000/audit', {
      cookies: { auth_session: cookieValue }
    })

    const response: any = await middleware(request)
    
    // Le middleware doit rediriger
    expect(response).toBeDefined()
    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toContain('?error=user_restricted')
  })

  it('middleware devrait bloquer un utilisateur de rôle ADMIN accédant aux pages de facturation opérationnelles', async () => {
    const session = { username: 'admin1', role: 'admin', exp: Date.now() + 3600000 }
    const cookieValue = await generateTestCookie(session)

    // L'admin tente d'accéder à la page de facturation métier /invoices
    const request = new NextRequest('http://localhost:3000/invoices', {
      cookies: { auth_session: cookieValue }
    })

    const response: any = await middleware(request)
    
    // L'admin doit être restreint
    expect(response).toBeDefined()
    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toContain('?error=admin_restricted')
  })

  it('middleware devrait autoriser un utilisateur de rôle USER sur les pages métiers opérationnelles', async () => {
    const session = { username: 'user1', role: 'user', exp: Date.now() + 3600000 }
    const cookieValue = await generateTestCookie(session)

    const request = new NextRequest('http://localhost:3000/invoices', {
      cookies: { auth_session: cookieValue }
    })

    const response: any = await middleware(request)
    
    // Doit renvoyer NextResponse.next() qui correspond à un statut 200 sans redirection
    expect(response.status).toBe(200)
    expect(response.headers.get('Location')).toBeNull()
  })
})
