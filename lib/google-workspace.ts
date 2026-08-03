import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// drive.file limita o Drive aos arquivos criados/abertos pelo app. Calendar é
// usado para espelhar os prazos do Vértice no calendário principal do usuário.
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
] as const

function required(name: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_TOKEN_ENCRYPTION_KEY') {
  const value = process.env[name]
  if (!value) throw new Error(`${name} não configurada.`)
  return value
}

function key() {
  const bytes = Buffer.from(required('GOOGLE_TOKEN_ENCRYPTION_KEY'), 'base64')
  if (bytes.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.')
  return bytes
}

export function googleRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL não configurada.')
  return `${base.replace(/\/$/, '')}/api/google/callback`
}

export function googleAuthorizationUrl(state: string) {
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: required('GOOGLE_CLIENT_ID'),
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString()
  return url.toString()
}

export async function exchangeGoogleCode(code: string): Promise<{ access_token: string; refresh_token: string; scope?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })
  const data = await res.json() as { access_token?: string; refresh_token?: string; scope?: string; error?: string }
  if (!res.ok || !data.access_token || !data.refresh_token) throw new Error(data.error || 'O Google não retornou acesso offline.')
  return { access_token: data.access_token, refresh_token: data.refresh_token, scope: data.scope }
}

export function cifrarToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

export function decifrarToken(payload: string) {
  const raw = Buffer.from(payload, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}

export async function googleEmail(accessToken: string) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  })
  const data = await res.json() as { email?: string }
  if (!res.ok || !data.email) throw new Error('Não foi possível identificar a conta Google.')
  return data.email
}

export async function revokeGoogleToken(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST', cache: 'no-store' })
}

export async function accessTokenFromRefreshToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
    body: new URLSearchParams({ client_id: required('GOOGLE_CLIENT_ID'), client_secret: required('GOOGLE_CLIENT_SECRET'), refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const data = await res.json() as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) throw new Error(data.error || 'A conexão Google expirou.')
  return data.access_token
}
