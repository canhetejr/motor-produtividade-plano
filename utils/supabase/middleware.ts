import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'
import { COOKIE_MFA } from '@/lib/mfa-cookie'

// Chamado pelo proxy.ts (Next 16, runtime nodejs): refresca a sessão e
// bloqueia não-logados. O gate de gestor fica em requireGestor()
// (lib/auth.ts), aplicado nas páginas e server actions — evita uma query
// de role por request aqui.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  // O callback OAuth chega sem sessão; ele precisa passar pelo route handler
  // para trocar o código PKCE por cookies antes de qualquer gate de login.
  // /auth/confirmar (link de troca de e-mail) tem o mesmo problema por outro
  // caminho: o link é clicado do cliente de e-mail, que pode ser outro
  // navegador — sem sessão, um redirect para /login descartaria o token antes
  // de ele ser verificado, e o link só vale uma vez.
  const isRotaAuth = request.nextUrl.pathname.startsWith('/auth/')
  // /formularios/[slug]: página pública de intake (sem login) que cria um
  // cartão no Kanban ao ser enviada — precisa ficar fora do gate de sessão.
  const isFormularioPublico = request.nextUrl.pathname.startsWith('/formularios/')
  // /q/[token]: acompanhamento somente leitura de um quadro, para quem esta
  // fora da equipe. A autorizacao e o proprio token, verificado na rota com
  // cliente de servico — nao ha sessao a exigir aqui.
  const isQuadroPublico = request.nextUrl.pathname.startsWith('/q/')
  // Fase 7: landing, precos, cadastro, aceite de convite e telas de conta
  // (suspensa/expirada) sao publicas ou tem seu proprio gate — nenhuma
  // chama requireUser() sem antes verificar o estado certo. '/conta/' em
  // particular NAO pode passar por aqui como logado-obrigatorio: e para
  // onde requireUser() redireciona quando a organizacao esta suspensa ou
  // expirada, e essas paginas nao chamam requireUser() (loop, ver
  // lib/auth.ts).
  const isMarketingOuConta =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname === '/precos' ||
    request.nextUrl.pathname === '/cadastro' ||
    request.nextUrl.pathname.startsWith('/convite/') ||
    request.nextUrl.pathname.startsWith('/conta/')

  // Segundo fator pendente: a sessao existe (a senha conferiu), mas o app fica
  // fechado ate o codigo ser verificado. O cookie e removido pelo servidor na
  // verificacao — apaga-lo no navegador nao libera nada, porque quem o remove
  // de verdade e a action.
  const mfaPendente = request.cookies.get(COOKIE_MFA)
  const isRotaMfa = request.nextUrl.pathname.startsWith('/login/verificar')
  if (user && mfaPendente && !isRotaMfa && !isFormularioPublico && !isQuadroPublico) {
    const url = request.nextUrl.clone()
    url.pathname = '/login/verificar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (
    !user &&
    !isAuthRoute &&
    !isRotaAuth &&
    !isFormularioPublico &&
    !isQuadroPublico &&
    !isMarketingOuConta
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
