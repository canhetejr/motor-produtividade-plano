import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { resolverBaseUrl } from '@/lib/base-url'
import { createAdminClient } from '@/utils/supabase/admin'
import { cifrarToken, exchangeGoogleCode, googleEmail, googleRedirectUri } from '@/lib/google-workspace'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const erro = url.searchParams.get('error')
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const cookieState = request.cookies.get('google_oauth_state')?.value
  // Mesmo cuidado da redirect_uri: a volta para o app precisa sair do
  // domínio por onde a pessoa entrou, não de um endereço interno.
  const redirect = new URL('/configuracoes', resolverBaseUrl(request))
  if (erro || !code || !state || !cookieState || state !== cookieState) {
    redirect.searchParams.set('google', 'erro')
    const response = NextResponse.redirect(redirect)
    response.cookies.delete('google_oauth_state')
    return response
  }
  try {
    const { user, profile } = await requireUser()
    // Mesma redirect_uri que foi usada na autorização — o Google recusa a
    // troca do código se as duas não baterem exatamente.
    const token = await exchangeGoogleCode(code, googleRedirectUri(request))
    const email = await googleEmail(token.access_token)
    const admin = createAdminClient()
    // colaborador_id é sempre user.id da própria sessão — o upsert só pode
    // escrever a conexão de quem está logado, nunca a de outra organização.
    const { error } = await admin.from('google_workspace_conexoes').upsert({
      colaborador_id: user.id, email, refresh_token_cifrado: cifrarToken(token.refresh_token),
      escopos: (token.scope ?? '').split(' ').filter(Boolean), atualizado_em: new Date().toISOString(),
      organizacao_id: profile.organizacao_id,
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
