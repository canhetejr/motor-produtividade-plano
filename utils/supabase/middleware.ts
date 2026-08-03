import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

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
  // /formularios/[slug]: página pública de intake (sem login) que cria um
  // cartão no Kanban ao ser enviada — precisa ficar fora do gate de sessão.
  const isFormularioPublico = request.nextUrl.pathname.startsWith('/formularios/')
  // /q/[token]: acompanhamento somente leitura de um quadro, para quem esta
  // fora da equipe. A autorizacao e o proprio token, verificado na rota com
  // cliente de servico — nao ha sessao a exigir aqui.
  const isQuadroPublico = request.nextUrl.pathname.startsWith('/q/')

  if (
    !user &&
    !isAuthRoute &&
    !isFormularioPublico &&
    !isQuadroPublico &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
