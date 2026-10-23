import crypto from 'crypto';
import { getSessionSecret } from '@/lib/api/auth';

/**
 * Chiffrement symétrique AES-256-GCM des secrets temporaires stockés localement
 * (ex: mots de passe de pending_cloud_members). Clé dérivée de SESSION_SECRET.
 * Format : "enc:v1:<iv b64>:<tag b64>:<ciphertext b64>"
 */
const PREFIX = 'enc:v1:';

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(`secret-store:${getSessionSecret()}`).digest();
}

export function isEncryptedSecret(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Déchiffre ; les anciennes valeurs en clair (sans préfixe) sont renvoyées telles quelles (rétro-compatibilité). */
export function decryptSecret(stored: string): string {
  if (!isEncryptedSecret(stored)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
