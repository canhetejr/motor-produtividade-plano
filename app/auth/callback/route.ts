import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { iniciarDesafioMfa } from '@/app/login/mfa-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/apontamento'
  if (!next.startsWith('/')) next = '/apontamento'

  if (!code) return NextResponse.redirect(new URL('/login?message=' + encodeURIComponent('Resposta inválida do Google.'), origin))

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(new URL('/login?message=' + encodeURIComponent('Não foi possível concluir o login com Google.'), origin))
  }

  // O Vértice não possui cadastro público: uma conta OAuth sem colaborador
  // correspondente não pode entrar apenas por possuir uma conta Google.
  const { data: profile } = await supabase
    .from('colaboradores')
    .select('id, nome, ativo, mfa_email_ativo')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!profile?.ativo) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?message=' + encodeURIComponent('Sua conta Google não está autorizada no Vértice. Solicite acesso ao gestor.'), origin))
  }

  await registrarAuditoria({ atorId: data.user.id, acao: 'auth.login', entidade: 'auth', depois: { metodo: 'google' } })
  if (profile.mfa_email_ativo && data.user.email) {
    await iniciarDesafioMfa(data.user.id, profile.nome, data.user.email)
    return NextResponse.redirect(new URL('/login/verificar', origin))
  }
  return NextResponse.redirect(new URL(next, origin))
}
