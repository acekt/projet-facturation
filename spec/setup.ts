import { vi } from 'vitest'
import '@testing-library/jest-dom'

// 1. Mock de l'API Web Crypto (crypto.subtle) pour Node.js / Vitest
if (!globalThis.crypto) {
  const { webcrypto } = require('crypto')
  globalThis.crypto = webcrypto
} else if (!globalThis.crypto.subtle) {
  const { webcrypto } = require('crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true
  })
}

// 2. Mock de better-sqlite3 : redirige l'écriture physique vers une base de données SQLite en mémoire (:memory:)
vi.mock('better-sqlite3', () => {
  const DatabaseReal = require('better-sqlite3')
  return {
    default: function(path: string, options?: any) {
      // Pour les tests, on utilise systématiquement une base de données en mémoire
      return new DatabaseReal(':memory:', options)
    }
  }
})

// 3. Mock complet des classes NextRequest et NextResponse de Next.js (next/server)
vi.mock('next/server', () => {
  class MockNextResponse {
    body: any
    status: number
    headers: {
      get: (name: string) => string | null
      set: (name: string, value: string) => void
      delete: (name: string) => void
    }
    cookies: {
      set: any
      delete: any
    }

    constructor(body: any, init?: any) {
      this.body = body
      this.status = init?.status || 200
      
      const headerMap = new Map(Object.entries(init?.headers || {}))
      this.headers = {
        get: (name: string) => headerMap.get(name) || null,
        set: (name: string, value: string) => headerMap.set(name, value),
        delete: (name: string) => headerMap.delete(name),
      }
      
      this.cookies = {
        set: vi.fn(),
        delete: vi.fn(),
      }
    }

    async json() {
      return this.body ? JSON.parse(this.body) : {}
    }

    static json(body: any, init?: any) {
      return new MockNextResponse(JSON.stringify(body), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers }
      })
    }

    static redirect(url: any, status = 307) {
      return new MockNextResponse('', { status, headers: { Location: url.toString() } })
    }

    static next() {
      return new MockNextResponse('', { status: 200 })
    }
  }

  class MockNextRequest {
    url: string
    nextUrl: URL
    cookies: {
      get: (name: string) => { name: string; value: string } | undefined
      getAll: () => { name: string; value: string }[]
      set: any
      delete: any
    }
    headers: Map<string, string>
    method: string
    bodyStr: string

    constructor(url: string, init?: any) {
      this.url = url
      this.nextUrl = new URL(url)
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.bodyStr = init?.body ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : ''

      const cookieMap = new Map()
      if (init?.cookies) {
        Object.entries(init.cookies).forEach(([k, v]) => {
          cookieMap.set(k, { name: k, value: String(v) })
        })
      }

      this.cookies = {
        get: (name: string) => cookieMap.get(name),
        getAll: () => Array.from(cookieMap.values()),
        set: vi.fn(),
        delete: vi.fn(),
      }
    }

    async json() {
      return this.bodyStr ? JSON.parse(this.bodyStr) : {}
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: MockNextRequest,
  }
})

// 4. Mock de next/headers pour le contrôle asynchrone des cookies dans les tests d'API
vi.mock('next/headers', () => {
  return {
    cookies: async () => {
      return {
        get: (name: string) => {
          const mockCookies = (globalThis as any).__mockCookies || {}
          return mockCookies[name] ? { name, value: mockCookies[name] } : undefined
        }
      }
    }
  }
})

// 5. Mock de next/navigation pour le rendu des composants utilisant le routeur Next.js
vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  }
})

// 6. Polyfill global de sessionStorage pour garantir le bon chargement de Zustand sous Node/Vitest
if (typeof globalThis.sessionStorage === 'undefined') {
  let store: any = {}
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = String(value) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { store = {} },
      length: 0,
      key: (index: number) => null
    },
    writable: true,
    configurable: true
  })
}


