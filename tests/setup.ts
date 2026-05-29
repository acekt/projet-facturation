import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock better-sqlite3 globally for testing to enforce in-memory safety
vi.mock('better-sqlite3', async (importActual) => {
  const actual = await importActual<typeof import('better-sqlite3')>();
  class MockDatabase extends actual.default {
    constructor(filename: string, options?: any) {
      // Force all database connections to use in-memory SQLite for isolated test state
      super(':memory:', options);
    }
  }
  return {
    default: MockDatabase,
  };
});

// Mock Web Crypto API for middleware signature verification
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        importKey: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
      },
    },
  });
}
