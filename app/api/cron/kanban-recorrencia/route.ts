import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, tentarReservarExecucao, paraCadaOrganizacao } from '@/lib/cron'
import { clonarCartaoBase } from '@/lib/kanban-clone'
import { agendarSincronizacaoGoogleEmLote } from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

// Vercel Cron: 0 9 * * * (6h em Maringá) — recria os cards recorrentes que já
// foram entregues.
//
// Quem agenda é o trigger `cartoes_aplicar_entrega` (bloco 29): ao entrar numa
// etapa final, o card com `recorrencia` ganha `proxima_recorrencia_em`. Este
// cron só varre o que já venceu. Reabrir o card limpa a agenda, então cancelar
// a repetição é só tirar o card da etapa final.
//
// Roda por organização, com try/catch independente por organização (via
// paraCadaOrganizacao).
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = new Date().toISOString().slice(0, 10)
  const criadosTotal: string[] = []

  const resultados = await paraCadaOrganizacao(admin, async (organizacaoId) => {
    if (!(await tentarReservarExecucao(admin, 'kanban-recorrencia', organizacaoId, hoje))) {
      return { skipped: 'já executado' }
    }

    const { data: vencidos, error } = await admin
      .from('cartoes')
      .select('id, titulo, criado_por, colunas!inner(quadro_id)')
      .eq('organizacao_id', organizacaoId)
      .not('proxima_recorrencia_em', 'is', null)
      .lte('proxima_recorrencia_em', hoje)
    if (error) throw error

    const criados: string[] = []
    const falhas: { cartaoId: string; motivo: string }[] = []

    for (const cartao of vencidos ?? []) {
      const quadroId = (cartao.colunas as unknown as { quadro_id: string } | null)?.quadro_id
      if (!quadroId) {
        falhas.push({ cartaoId: cartao.id, motivo: 'card sem quadro' })
        continue
      }

      // A ocorrência nova nasce na primeira etapa do quadro — recomeçar do
      // início do fluxo é o que "repetir a tarefa" significa.
      const { data: primeiraColuna } = await admin
        .from('colunas')
        .select('id')
        .eq('organizacao_id', organizacaoId)
        .eq('quadro_id', quadroId)
        .order('posicao')
        .limit(1)
        .maybeSingle()

      if (!primeiraColuna) {
        falhas.push({ cartaoId: cartao.id, motivo: 'quadro sem colunas' })
        continue
      }

      const clone = await clonarCartaoBase(admin, cartao.id, cartao.criado_por, organizacaoId, {
        colunaDestinoId: primeiraColuna.id,
        manterRecorrencia: true,
      })

      if (!clone.ok) {
        falhas.push({ cartaoId: cartao.id, motivo: clone.error })
        continue
      }

      // Só desarma a agenda do original depois que a cópia existe — se o
      // clone falhar, a próxima execução tenta de novo.
      await admin
        .from('cartoes')
        .update({ proxima_recorrencia_em: null })
        .eq('id', cartao.id)
        .eq('organizacao_id', organizacaoId)
      criados.push(clone.id)
    }

    if (falhas.length > 0) {
      console.error('kanban-recorrencia: %d card(s) não recriados na organização %s: %j', falhas.length, organizacaoId, falhas)
    }

    criadosTotal.push(...criados)

    return { avaliados: vencidos?.length ?? 0, criados: criados.length, falhas: falhas.length }
  })

  agendarSincronizacaoGoogleEmLote(criadosTotal)

  return NextResponse.json({
    ok: resultados.every((r) => r.ok),
    hoje,
    resultados,
  })
}
