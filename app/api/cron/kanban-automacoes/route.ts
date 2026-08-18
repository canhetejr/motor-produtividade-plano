import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, tentarReservarExecucao, paraCadaOrganizacao } from '@/lib/cron'
import { dispararEvento } from '@/lib/automacoes'

export const dynamic = 'force-dynamic'

// Agendado de hora em hora (0 * * * *) — avalia os eventos de automação que
// ninguém "faz acontecer": atraso e SLA da etapa.
//
// Quem agenda é o host, não este arquivo: as tarefas agendadas do Coolify
// (ver docs/PLANO-MIGRACAO-COOLIFY.md §Crons). A agenda de lá precisa bater
// com CRONS_DECLARADOS em lib/admin-saude.ts — é contra ela que o /console
// decide se um cron está atrasado.
//
// Por que de hora em hora e não diário: "perto de atrasar" com granularidade
// de um dia avisaria tarde demais pra ter serventia, e SLA de etapa costuma
// ser contado em horas. Rodou diário enquanto a Vercel agendava, porque o
// plano Hobby recusa o deploy de qualquer agenda mais frequente que isso —
// limite que deixou de existir junto com o vercel.json.
//
// A chave de idempotência inclui a hora, então o retry do agendador dentro da
// mesma hora vira no-op, mas a execução da hora seguinte roda normalmente.
//
// Roda por organização, com try/catch independente por organização (via
// paraCadaOrganizacao).

const JANELA_PADRAO_HORAS = 24

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const agora = new Date()
  const chave = agora.toISOString().slice(0, 13) // YYYY-MM-DDTHH

  const resultados = await paraCadaOrganizacao(admin, async (organizacaoId) => {
    if (!(await tentarReservarExecucao(admin, 'kanban-automacoes', organizacaoId, chave))) {
      return { skipped: 'já executado nesta hora' }
    }

    // Só os quadros que têm automação de tempo ativa entram na varredura —
    // não faz sentido escanear cards de quadro que não automatizou nada.
    const { data: automacoes, error: automacoesError } = await admin
      .from('automacoes')
      .select('quadro_id, evento, evento_config')
      .eq('organizacao_id', organizacaoId)
      .eq('ativa', true)
      .in('evento', ['cartao_atrasou', 'cartao_perto_atrasar', 'sla_estourado', 'sla_perto_estourar'])
    if (automacoesError) throw automacoesError

    if (!automacoes || automacoes.length === 0) {
      return { quadros: 0, disparos: 0 }
    }

    const quadroIds = [...new Set(automacoes.map((a) => a.quadro_id))]
    const eventosPorQuadro = new Map<string, Set<string>>()
    const horasAntesPorQuadro = new Map<string, number>()
    for (const a of automacoes) {
      const set = eventosPorQuadro.get(a.quadro_id) ?? new Set<string>()
      set.add(a.evento)
      eventosPorQuadro.set(a.quadro_id, set)

      const horas = (a.evento_config as { horasAntes?: number } | null)?.horasAntes
      if (typeof horas === 'number' && horas > 0) {
        horasAntesPorQuadro.set(a.quadro_id, Math.max(horasAntesPorQuadro.get(a.quadro_id) ?? 0, horas))
      }
    }

    const { data: colunas, error: colunasError } = await admin
      .from('colunas')
      .select('id, quadro_id, sla_horas, etapa_final')
      .eq('organizacao_id', organizacaoId)
      .in('quadro_id', quadroIds)
    if (colunasError) throw colunasError

    const colunaIds = (colunas ?? []).map((c) => c.id)
    if (colunaIds.length === 0) {
      return { quadros: quadroIds.length, disparos: 0 }
    }

    // Card entregue saiu do fluxo: não atrasa nem estoura SLA.
    // `updated_at`/`created_at` vêm junto porque são a âncora de dedupe dos
    // eventos de prazo (ver `ancoraDedupe`).
    const { data: cartoes, error: cartoesError } = await admin
      .from('cartoes')
      .select('id, coluna_id, prazo, etapa_desde, updated_at, created_at')
      .eq('organizacao_id', organizacaoId)
      .in('coluna_id', colunaIds)
      .is('entregue_em', null)
    if (cartoesError) throw cartoesError

    const colunaPorId = new Map((colunas ?? []).map((c) => [c.id, c]))
    let disparos = 0

    for (const cartao of cartoes ?? []) {
      const coluna = colunaPorId.get(cartao.coluna_id)
      if (!coluna || coluna.etapa_final) continue

      const eventos = eventosPorQuadro.get(coluna.quadro_id)
      if (!eventos) continue

      const horasAntes = horasAntesPorQuadro.get(coluna.quadro_id) ?? JANELA_PADRAO_HORAS
      const base = { supabase: admin, cartaoId: cartao.id, quadroId: coluna.quadro_id, atorId: null, organizacaoId }

      // Estes eventos descrevem um ESTADO que persiste ("está atrasado"), não
      // um acontecimento. Sem a âncora de dedupe, toda varredura redispararia
      // o mesmo card enquanto a condição durasse.
      const dedupePorEdicao = cartao.updated_at ?? cartao.created_at
      const dedupePorEtapa = cartao.etapa_desde ?? undefined

      // --- prazo ---
      if (cartao.prazo) {
        // `prazo` é date: o card só está atrasado depois do fim daquele dia.
        const fimDoPrazo = new Date(`${cartao.prazo}T23:59:59`)
        const horasParaOPrazo = (fimDoPrazo.getTime() - agora.getTime()) / 3_600_000

        if (horasParaOPrazo < 0 && eventos.has('cartao_atrasou')) {
          await dispararEvento({ ...base, evento: 'cartao_atrasou', dedupeDesde: dedupePorEdicao })
          disparos += 1
        } else if (horasParaOPrazo >= 0 && horasParaOPrazo <= horasAntes && eventos.has('cartao_perto_atrasar')) {
          await dispararEvento({ ...base, evento: 'cartao_perto_atrasar', dedupeDesde: dedupePorEdicao })
          disparos += 1
        }
      }

      // --- SLA da etapa ---
      if (coluna.sla_horas && cartao.etapa_desde) {
        const horasNaEtapa = (agora.getTime() - new Date(cartao.etapa_desde).getTime()) / 3_600_000
        const restante = coluna.sla_horas - horasNaEtapa

        if (restante < 0 && eventos.has('sla_estourado')) {
          await dispararEvento({ ...base, evento: 'sla_estourado', dados: { colunaId: coluna.id }, dedupeDesde: dedupePorEtapa })
          disparos += 1
        } else if (restante >= 0 && restante <= horasAntes && eventos.has('sla_perto_estourar')) {
          await dispararEvento({ ...base, evento: 'sla_perto_estourar', dados: { colunaId: coluna.id }, dedupeDesde: dedupePorEtapa })
          disparos += 1
        }
      }
    }

    return { quadros: quadroIds.length, cartoes: cartoes?.length ?? 0, disparos }
  })

  return NextResponse.json({
    ok: resultados.every((r) => r.ok),
    chave,
    resultados,
  })
}
