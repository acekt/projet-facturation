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

// Mock @/lib/db to route repository and service queries to the test database
vi.mock('@/lib/db', async () => {
  const { getTestDatabase } = await import('./helpers/db')
  const testDb = getTestDatabase()
  return {
    default: testDb,
    prepareCached: (sql: string) => testDb.prepare(sql),
  }
})

// Set dummy Supabase env variables for test environment
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test-tenant.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'

// Mock @/lib/powersync to prevent browser WebWorker & SupabaseClient initialization in node test environment
vi.mock('@/lib/powersync', () => ({
  powerSync: {
    init: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
  connector: {
    init: vi.fn().mockResolvedValue(undefined),
    registerListener: vi.fn(() => () => {}),
    isAuthenticated: false,
    fetchCredentials: vi.fn().mockResolvedValue(null),
  },
  PowerSyncProvider: ({ children }: { children: any }) => children,
  usePowerSync: () => ({
    get: vi.fn(),
    getAll: vi.fn(),
    execute: vi.fn(),
  }),
  useQuery: () => [],
  useStatus: () => ({ connected: false }),
}))

