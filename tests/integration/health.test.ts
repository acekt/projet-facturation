import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('🚨 AUDIT TDD — ENDPOINT DE SANTÉ (/api/health) 🚨', () => {
  it('devrait retourner 200 OK avec status ok et un timestamp pour le verrou Electron', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(typeof data.timestamp).toBe('number');
  });
});
