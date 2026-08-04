import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { sincronizarCartaoNoGoogle } from '@/lib/google-calendar'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return new NextResponse('Forbidden', { status: 403 })

  const { user } = await requireUser()
  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('google_workspace_conexoes')
    .select('colaborador_id')
    .eq('colaborador_id', user.id)
    .maybeSingle()
  if (!connection) return NextResponse.redirect(new URL('/perfil?google=nao-conectado', request.url), 303)

  try {
    const { data: responsaveis, error } = await admin
      .from('cartoes_responsaveis')
      .select('cartao_id, cartoes!inner(prazo)')
      .eq('colaborador_id', user.id)
      .not('cartoes.prazo', 'is', null)
    if (error) throw error

    let total = 0
    let falhas = 0
    for (const item of responsaveis ?? []) {
      const resultado = await sincronizarCartaoNoGoogle(item.cartao_id)
      total += resultado.sincronizados
      falhas += resultado.falhas
    }

    const redirect = new URL('/perfil', request.url)
    redirect.searchParams.set('google', falhas > 0 ? 'parcial' : 'sincronizado')
    redirect.searchParams.set('total', String(total))
    return NextResponse.redirect(redirect, 303)
  } catch (error) {
    console.error('[google calendar manual sync]', error)
    return NextResponse.redirect(new URL('/perfil?google=erro', request.url), 303)
  }
}
