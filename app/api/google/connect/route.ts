import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireUser } from '@/lib/auth'
import { googleAuthorizationUrl } from '@/lib/google-workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireUser()
  const state = randomBytes(32).toString('base64url')
  const response = NextResponse.redirect(googleAuthorizationUrl(state))
  response.cookies.set('google_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/api/google' })
  return response
}
