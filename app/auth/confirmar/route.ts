import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { destinoInternoSeguro } from '@/lib/auth-redirect'

export const dynamic = 'force-dynamic'

/**
 * Aterrissagem dos links de confirmação enviados pelo Supabase Auth — hoje só
 * a troca de e-mail (`solicitarTrocaEmail` em app/(app)/perfil/actions.ts).
 *
 * POR QUE UMA ROTA SEPARADA DE /auth/callback:
 * o callback é o retorno do OAuth do Google e assume um `code` PKCE, com
 * mensagens de erro que citam o Google literalmente. Um link de e-mail que
 * falhasse ali diria "não foi possível concluir o login com Google", que é
 * desorientador. Além disso o callback exige colaborador ativo e registra
 * `auth.login` — nada disso se aplica a quem já está logado confirmando o
 * próprio endereço.
 *
 * POR QUE ACEITA DUAS FORMAS:
 * o formato do link depende da configuração do template no painel do Supabase.
 * O template padrão manda o navegador para `/auth/v1/verify`, que redireciona
 * para cá com `code` (fluxo PKCE); um template escrito com `{{ .TokenHash }}`
 * chega direto com `token_hash` + `type`. Tratar as duas evita que a feature
 * dependa de uma configuração de painel que este código não controla.
 *
 * PENDENTE DE CONFERÊNCIA EM STAGING: qual das duas formas o projeto de fato
 * envia, e se "Secure email change" (confirmação nos dois endereços) está
 * ligado — isso muda o texto que /perfil mostra, não o comportamento daqui.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const next = destinoInternoSeguro(searchParams.get('next'), origin, '/perfil')

  const erro = (mensagem: string) =>
    NextResponse.redirect(new URL(`${next}?erro_email=${encodeURIComponent(mensagem)}`, origin))

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type')

  const supabase = await createClient()

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // `email_change` é o único tipo que chega aqui hoje; o fallback existe
      // para não engolir em silêncio um link de outro tipo que passe a ser
      // apontado para esta rota no futuro.
      type: (tipo as 'email_change') ?? 'email_change',
    })
    if (error) {
      console.error('Falha ao confirmar link de e-mail: %s', error.message)
      return erro('O link de confirmação expirou ou já foi usado. Peça a troca de novo.')
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Falha ao trocar código de confirmação: %s', error.message)
      return erro('O link de confirmação expirou ou já foi usado. Peça a troca de novo.')
    }
  } else {
    return erro('Link de confirmação inválido.')
  }

  // "Secure email change" ligado exige confirmação nos DOIS endereços: depois
  // do primeiro clique a troca ainda não terminou, e `new_email` continua
  // preenchido. Dizer "pronto" aqui faria a pessoa parar no meio do caminho.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const aindaPendente = Boolean(user?.new_email)

  return NextResponse.redirect(
    new URL(`${next}?email_atualizado=${aindaPendente ? 'parcial' : '1'}`, origin)
  )
}
