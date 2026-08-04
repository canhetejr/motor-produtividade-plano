import { NextResponse } from 'next/server'

import { cronAuthorized, tentarReservarExecucao } from '@/lib/cron'
import { sincronizarCartaoNoGoogle } from '@/lib/google-calendar'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Rede de segurança da sincronização imediata. A criação/edição agenda o envio
// logo após a resposta; este cron recupera falhas temporárias e alterações
// feitas por rotinas internas que não passam pela interface.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const agora = new Date()
    const minuto = Math.floor(agora.getUTCMinutes() / 10) * 10
    const chave = `${agora.toISOString().slice(0, 13)}:${String(minuto).padStart(2, '0')}`
    if (!(await tentarReservarExecucao(admin, 'google-calendar-sync', chave))) {
      return NextResponse.json({ ok: true, chave, skipped: 'já executado nesta janela' })
    }

    const [{ data: responsaveis, error: responsaveisError }, { data: eventos, error: eventosError }] = await Promise.all([
      admin
        .from('cartoes_responsaveis')
        .select('cartao_id, cartoes!inner(prazo)')
        .not('cartoes.prazo', 'is', null),
      admin.from('google_calendar_eventos').select('cartao_id'),
    ])
    if (responsaveisError) throw responsaveisError
    if (eventosError) throw eventosError

    const cartaoIds = [...new Set([
      ...(responsaveis ?? []).map((item) => item.cartao_id),
      ...(eventos ?? []).map((item) => item.cartao_id),
    ])]

    let sincronizados = 0
    let removidos = 0
    let semConexao = 0
    let falhas = 0
    for (const cartaoId of cartaoIds) {
      const resultado = await sincronizarCartaoNoGoogle(cartaoId)
      sincronizados += resultado.sincronizados
      removidos += resultado.removidos
      semConexao += resultado.semConexao
      falhas += resultado.falhas
    }

    return NextResponse.json({ ok: falhas === 0, chave, cartoes: cartaoIds.length, sincronizados, removidos, semConexao, falhas })
  } catch (error) {
    console.error('[cron google calendar sync]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
