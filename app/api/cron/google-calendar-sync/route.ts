import { NextResponse } from 'next/server'

import { cronAuthorized, paraCadaOrganizacao } from '@/lib/cron'
import { sincronizarCartoesNoGoogle } from '@/lib/google-calendar'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TAMANHO_PAGINA = 500

async function carregarTodosCartoesComGoogle(admin: ReturnType<typeof createAdminClient>, organizacaoId: string) {
  const ids = new Set<string>()

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await admin
      .from('cartoes_responsaveis')
      .select('cartao_id, colaborador_id, cartoes!inner(prazo)')
      .eq('organizacao_id', organizacaoId)
      .not('cartoes.prazo', 'is', null)
      .order('cartao_id')
      .order('colaborador_id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw error
    for (const item of data ?? []) ids.add(item.cartao_id)
    if ((data?.length ?? 0) < TAMANHO_PAGINA) break
  }

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await admin
      .from('google_calendar_eventos')
      .select('cartao_id, colaborador_id')
      .eq('organizacao_id', organizacaoId)
      .order('cartao_id')
      .order('colaborador_id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw error
    for (const item of data ?? []) ids.add(item.cartao_id)
    if ((data?.length ?? 0) < TAMANHO_PAGINA) break
  }

  return [...ids]
}

// Rede de segurança da sincronização imediata. A criação/edição agenda o envio
// logo após a resposta; este cron recupera falhas temporárias e alterações
// feitas por rotinas internas que não passam pela interface.
//
// Roda por organização, com try/catch independente por organização (via
// paraCadaOrganizacao).
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const agora = new Date()
  const chave = agora.toISOString()

  const resultados = await paraCadaOrganizacao(admin, async (organizacaoId) => {
    const cartaoIds = await carregarTodosCartoesComGoogle(admin, organizacaoId)
    const { sincronizados, removidos, semConexao, falhas } = await sincronizarCartoesNoGoogle(cartaoIds, 5)
    return { cartoes: cartaoIds.length, sincronizados, removidos, semConexao, falhas }
  })

  return NextResponse.json({
    ok: resultados.every((r) => r.ok && r.resultado.falhas === 0),
    chave,
    resultados,
  })
}
