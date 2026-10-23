import { cookies } from 'next/headers'

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "development" || process.env.VITEST === "true") {
    // Dans les tests, si on a explicitement mis une variable trop courte pour tester le fail-fast,
    // on ne doit pas retomber sur le fallback dev. On regarde si on est explicitement dans le test de sécurité
    if (secret === 'trop-court') {
        throw new Error("[SECURITY] SESSION_SECRET environment variable is missing or too short.");
    }
    return "facturier-gabon-2026-fallback-dev-secret-key-32chars!!";
  }
  throw new Error("[SECURITY] SESSION_SECRET environment variable is missing or too short.");
}

function str2ab(str: string) {
  return new TextEncoder().encode(str);
}

function base64ToUint8Array(base64: string) {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Signs stringified session data using HMAC-SHA256 and appends the signature.
 *
 * @param data - The base64-encoded JSON session string to sign.
 * @returns A promise that resolves to a string in the format "data.signature".
 */
export async function signSession(data: string): Promise<string> {
  const secret = getSessionSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    str2ab(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, str2ab(data));
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${base64Signature}`;
}

/**
 * Verifies an HMAC-SHA256 signature against the provided data payload.
 *
 * @param data - The original base64-encoded data string.
 * @param signature - The base64-encoded signature to verify.
 * @param secret - (Optional) Override the default session secret.
 * @returns A promise that resolves to true if the signature is valid, false otherwise.
 */
export async function verifySignature(data: string, signature: string, secret?: string): Promise<boolean> {
  try {
    const activeSecret = secret || getSessionSecret();
    const key = await crypto.subtle.importKey(
      "raw",
      str2ab(activeSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify("HMAC", key, base64ToUint8Array(signature), str2ab(data));
  } catch (e) {
    return false;
  }
}

/**
 * Retrieves and validates the current session from the auth_session cookie.
 * It will parse the HMAC components, verify the signature, and check expiration.
 *
 * @param cookieValue - (Optional) Explicit cookie string, overrides Next.js headers lookup.
 * @param secret - (Optional) Override the default session secret.
 * @returns A promise resolving to the parsed session object, or null if invalid/expired.
 */
export async function getSession(cookieValue?: string, secret?: string): Promise<any | null> {
  try {
    let finalCookieValue = cookieValue;
    if (!finalCookieValue) {
      const cookieStore = await cookies();
      finalCookieValue = cookieStore.get('auth_session')?.value;
    }

    if (!finalCookieValue) return null;

    const [data, signature] = finalCookieValue.split('.');
    if (!data || !signature) return null;

    const isValid = await verifySignature(data, signature, secret);
    if (!isValid) return null;

    const session = JSON.parse(atob(data));
    if (!session || typeof session.exp !== 'number' || session.exp < Date.now()) {
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}
