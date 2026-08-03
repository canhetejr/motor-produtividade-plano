import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { cifrarToken, exchangeGoogleCode, googleEmail } from '@/lib/google-workspace'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const erro = url.searchParams.get('error')
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const cookieState = request.cookies.get('google_oauth_state')?.value
  const redirect = new URL('/perfil', request.url)
  if (erro || !code || !state || !cookieState || state !== cookieState) {
    redirect.searchParams.set('google', 'erro')
    const response = NextResponse.redirect(redirect)
    response.cookies.delete('google_oauth_state')
    return response
  }
  try {
    const { user } = await requireUser()
    const token = await exchangeGoogleCode(code)
    const email = await googleEmail(token.access_token)
    const admin = createAdminClient()
    const { error } = await admin.from('google_workspace_conexoes').upsert({
      colaborador_id: user.id, email, refresh_token_cifrado: cifrarToken(token.refresh_token),
      escopos: (token.scope ?? '').split(' ').filter(Boolean), atualizado_em: new Date().toISOString(),
    })
    if (error) throw error
    redirect.searchParams.set('google', 'conectado')
  } catch (error) {
    console.error('[google callback]', error)
    redirect.searchParams.set('google', 'erro')
  }
  const response = NextResponse.redirect(redirect)
  response.cookies.delete('google_oauth_state')
  return response
}
