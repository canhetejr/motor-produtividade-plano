import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
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

  // Proteger rotas (exemplo inicial, pode ser ajustado conforme a necessidade)
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  
  if (!user && !isAuthRoute && request.nextUrl.pathname !== '/') {
    // se não estiver logado e tentar acessar algo que não seja publico/login, redirecionar pro login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Verifica roles se o usuário tentar acessar rotas de gestor
  if (user && (
    request.nextUrl.pathname.startsWith('/dashboard') || 
    request.nextUrl.pathname.startsWith('/catalogo') || 
    request.nextUrl.pathname.startsWith('/colaboradores') || 
    request.nextUrl.pathname.startsWith('/relatorios')
  )) {
    // Buscar a role do usuário. Note: em edge middleware, é melhor guardar na claim do JWT
    // ou fazer uma chamada rápida.
    const { data: profile } = await supabase
      .from('colaboradores')
      .select('role')
      .eq('id', user.id)
      .single()
      
    if (!profile || profile.role !== 'gestor') {
      const url = request.nextUrl.clone()
      url.pathname = '/apontamento' // Redireciona o colaborador que tentar ser esperto
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
