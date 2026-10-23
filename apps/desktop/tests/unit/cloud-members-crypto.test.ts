import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { encryptSecret, decryptSecret, isEncryptedSecret } from '@/lib/crypto/secretStore';
import { enqueueCloudMember } from '@/lib/sync/cloudMembers';

describe('Étape 1.1 — Chiffrement des mots de passe pending_cloud_members', () => {
  beforeEach(() => {
    db.exec('DELETE FROM pending_cloud_members;');
  });

  it('chiffre puis déchiffre (aller-retour), IV aléatoire', () => {
    const a = encryptSecret('Secret2026!');
    const b = encryptSecret('Secret2026!');
    expect(isEncryptedSecret(a)).toBe(true);
    expect(a).not.toContain('Secret2026!');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('Secret2026!');
  });

  it('rejette une valeur altérée (GCM auth tag)', () => {
    const parts = encryptSecret('abc').split(':');
    parts[4] = Buffer.from('tampered').toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('reste rétro-compatible avec une ancienne valeur en clair', () => {
    expect(decryptSecret('ancien-mdp')).toBe('ancien-mdp');
  });

  it('enqueueCloudMember ne stocke aucun mot de passe en clair', () => {
    enqueueCloudMember({ email: 'Op@Test.ga', password: 'MotDePasse123', name: 'Op', role: 'user' });
    const row = db.prepare('SELECT password FROM pending_cloud_members WHERE email = ?').get('op@test.ga') as { password: string };
    expect(row.password).not.toContain('MotDePasse123');
    expect(decryptSecret(row.password)).toBe('MotDePasse123');
  });
});
