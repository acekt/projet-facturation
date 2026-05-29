import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_SECRET = 'letoile-secret-key-2026-signing';

export async function getSession() {
  try {
    const sessionCookie = (await cookies()).get('auth_session')?.value;
    if (!sessionCookie) return null;

    const [data, signature] = sessionCookie.split('.');
    if (!data || !signature) return null;

    // Verify signature using SubtleCrypto
    const key = await crypto.webcrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBuf = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const dataBuf = new TextEncoder().encode(data);

    const isValid = await crypto.webcrypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      dataBuf
    );

    if (!isValid) return null;

    const decoded = JSON.parse(atob(data));

    // Check expiration
    if (decoded.exp < Date.now()) return null;

    return decoded;
  } catch (error) {
    console.error('Session retrieval error:', error);
    return null;
  }
}
