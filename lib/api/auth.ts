import { cookies } from 'next/headers'

/**
 * SECURITY: SESSION_SECRET must be set in environment variables.
 * The application will crash at call time if the secret is absent or too short.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      '[SECURITY] SESSION_SECRET environment variable is missing or too short (minimum 32 characters). ' +
      'Set it in your .env.local file.'
    )
  }
  return secret
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

export async function signSession(data: string): Promise<string> {
  const secret = getSessionSecret()
  const key = await crypto.subtle.importKey(
    'raw',
    str2ab(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    str2ab(data)
  )

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return `${data}.${base64Signature}`
}

async function verifySignature(data: string, signature: string) {
  try {
    const secret = getSessionSecret()
    const key = await crypto.subtle.importKey(
      'raw',
      str2ab(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Use Buffer fallback for Node.js or manual decoding for Edge Runtime
    let sigBuf: Uint8Array
    if (typeof Buffer !== 'undefined') {
      sigBuf = Uint8Array.from(Buffer.from(signature, 'base64'))
    } else {
      const binaryString = atob(signature)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      sigBuf = bytes
    }

    const dataBuf = str2ab(data)

    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf.buffer as ArrayBuffer,
      dataBuf
    )
  } catch (e) {
    console.error('[Auth] Signature verification failed:', e)
    return false
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth_session')

  if (!sessionCookie) {
    return null
  }

  const [data, signature] = sessionCookie.value.split('.')
  if (!data || !signature) {
    return null
  }

  const isValid = await verifySignature(data, signature)
  if (!isValid) {
    return null
  }

  try {
    const decoded = atob(data)
    const session = JSON.parse(decoded)
    if (!session || typeof session.exp !== 'number' || session.exp < Date.now()) {
      return null
    }
    return session
  } catch (e) {
    console.error('[Auth] Failed to decode session:', e)
    return null
  }
}
