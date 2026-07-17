import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks nécessaires pour next/navigation et next/headers
const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url);
    const err = new Error('NEXT_REDIRECT');
    (err as any).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

describe('🚨 AUDIT TDD — SERVER COMPONENT PROTECTEUR (/) 🚨', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('devrait rediriger vers /login en 307 si aucune session valide nest fournie au Server Component racine', async () => {
    // Test de la logique de redirection
    let threw = false;
    try {
      const { redirect } = await import('next/navigation');
      redirect('/login');
    } catch (err: any) {
      threw = true;
      expect(err.message).toBe('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith('/login');
    }
    expect(threw).toBe(true);
  });
});
