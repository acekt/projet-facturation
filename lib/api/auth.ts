import { cookies } from 'next/headers'

const SESSION_SECRET = process.env.SESSION_SECRET || 'letoile-secret-key-2026-signing'

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

async function verifySignature(data: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      str2ab(SESSION_SECRET),
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
      sigBuf.buffer,
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
    console.log('[Auth] No session cookie found')
    return null
  }

  const [data, signature] = sessionCookie.value.split('.')
  if (!data || !signature) {
    console.log('[Auth] Invalid session cookie format')
    return null
  }

  const isValid = await verifySignature(data, signature)
  if (!isValid) {
    console.log('[Auth] Invalid session signature')
    return null
  }

  try {
    const decoded = atob(data)
    const session = JSON.parse(decoded)
    console.log('[Auth] Session valid for user:', session.userId || session.id)
    return session
  } catch (e) {
    console.error('[Auth] Failed to decode session:', e)
    return null
  }
}
