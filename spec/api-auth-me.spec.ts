import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GET } from '@/app/api/auth/me/route'
import db from '@/lib/db'

describe('Route API GET /api/auth/me', () => {
  beforeEach(() => {
    // Nettoyer la table des utilisateurs
    db.prepare('DELETE FROM users').run()
    // Injecter un utilisateur de test dans SQLite en mémoire
    db.prepare(`
      INSERT INTO users (id, username, password, name, role)
      VALUES ('user-id-123', 'gabriel', 'hashedpassword', 'Gabriel', 'user')
    `).run()
    
    // Vider les cookies simulés
    ;(globalThis as any).__mockCookies = {}
  })

  afterEach(() => {
    // Nettoyer après chaque test
    db.prepare('DELETE FROM users').run()
    ;(globalThis as any).__mockCookies = {}
  })

  it('devrait retourner un statut 401 si le cookie de session est absent', async () => {
    // Session vide
    ;(globalThis as any).__mockCookies = {}

    const response = await GET()
    expect(response.status).toBe(401)
    
    const data = await response.json()
    expect(data.error).toBe('Not authenticated')
  })

  it('devrait retourner un statut 200 avec les informations de l\'utilisateur si la session est valide', async () => {
    // Associer la session de test à l'identifiant de l'utilisateur inséré
    ;(globalThis as any).__mockCookies = {
      auth_session: 'user-id-123'
    }

    const response = await GET()
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.user).toBeDefined()
    expect(data.user.id).toBe('user-id-123')
    expect(data.user.name).toBe('Gabriel')
    expect(data.user.role).toBe('user')
  })

  it('devrait retourner un statut 404 si la session est présente mais l\'utilisateur n\'existe pas en BDD', async () => {
    // Session valide mais identifiant absent de la BDD
    ;(globalThis as any).__mockCookies = {
      auth_session: 'non-existent-user'
    }

    const response = await GET()
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe('User not found')
  })
})
