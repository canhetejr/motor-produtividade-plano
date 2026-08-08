import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { sincronizarCartoesNoGoogle } from '@/lib/google-calendar'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

async function carregarCartoesDoColaborador(admin: ReturnType<typeof createAdminClient>, colaboradorId: string) {
  const ids: string[] = []
  const tamanhoPagina = 500
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await admin
      .from('cartoes_responsaveis')
      .select('cartao_id, cartoes!inner(prazo)')
      .eq('colaborador_id', colaboradorId)
      .not('cartoes.prazo', 'is', null)
      .order('cartao_id')
      .range(inicio, inicio + tamanhoPagina - 1)
    if (error) throw error
    ids.push(...(data ?? []).map((item) => item.cartao_id))
    if ((data?.length ?? 0) < tamanhoPagina) break
  }
  return ids
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return new NextResponse('Forbidden', { status: 403 })

  const { user } = await requireUser()
  const admin = createAdminClient()
  // Toda consulta abaixo é travada em colaborador_id = user.id (a própria
  // sessão) — não em id vindo de query string/body — então não há id de
  // outra organização alcançável por aqui; organizacao_id explícito não
  // acrescentaria isolamento além do que .eq('colaborador_id', user.id) já dá.
  const { data: connection } = await admin
    .from('google_workspace_conexoes')
    .select('colaborador_id')
    .eq('colaborador_id', user.id)
    .maybeSingle()
  if (!connection) return NextResponse.redirect(new URL('/perfil?google=nao-conectado', request.url), 303)

  try {
    const cartaoIds = await carregarCartoesDoColaborador(admin, user.id)
    const resultado = await sincronizarCartoesNoGoogle(cartaoIds, 4)
    const total = resultado.sincronizados
    const falhas = resultado.falhas

    const redirect = new URL('/perfil', request.url)
    redirect.searchParams.set('google', falhas > 0 ? 'parcial' : 'sincronizado')
    redirect.searchParams.set('total', String(total))
    return NextResponse.redirect(redirect, 303)
  } catch (error) {
    console.error('[google calendar manual sync]', error)
    return NextResponse.redirect(new URL('/perfil?google=erro', request.url), 303)
  }
}
