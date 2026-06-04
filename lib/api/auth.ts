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

    const sigBuf = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
    const dataBuf = str2ab(data)

    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      dataBuf
    )
  } catch (e) {
    return false
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth_session')

  if (!sessionCookie) return null

  const [data, signature] = sessionCookie.value.split('.')
  if (!data || !signature) return null

  const isValid = await verifySignature(data, signature)
  if (!isValid) return null

  try {
    const decoded = atob(data)
    return JSON.parse(decoded)
  } catch (e) {
    return null
  }
}
