import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, getEmailsPorId, tentarReservarExecucao, paraCadaOrganizacao } from '@/lib/cron'
import { sendEmail, emailAlertaQueda } from '@/lib/email'
import { diasUteisAnteriores, formatarDataBR } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const LIMITE = 0.7

// Vercel Cron: 0 11 * * 1-5 (8h em Maringá) — alerta gestores sobre quem
// ficou abaixo de 70% nos 2 últimos dias úteis. Roda por organização, com
// try/catch independente por organização (via paraCadaOrganizacao).
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const dias = diasUteisAnteriores(2)

  const resultados = await paraCadaOrganizacao(admin, async (organizacaoId) => {
    if (!(await tentarReservarExecucao(admin, 'alerta-queda', organizacaoId, dias.join(',')))) {
      return { skipped: 'já executado' }
    }

    const { data: ativos, error: e1 } = await admin
      .from('colaboradores')
      .select('id, nome, role, notif_alerta_queda')
      .eq('organizacao_id', organizacaoId)
      .eq('ativo', true)
    if (e1) throw e1

    const { data: org } = await admin.from('organizacoes').select('email_remetente_nome').eq('id', organizacaoId).maybeSingle()
    const remetenteNome = org?.email_remetente_nome ?? null

    const idsAtivos = (ativos ?? []).map((c) => c.id)

    // indicadores_diarios é view sem organizacao_id na saída (PostgREST só
    // embeda relacionamento se as colunas da FK composta aparecerem inteiras
    // na view — ver 20260809120000). Filtrar por colaborador_id da própria
    // organização (já resolvidos acima) tem o mesmo efeito de isolamento.
    const { data: indicadores, error: e2 } =
      idsAtivos.length === 0
        ? { data: [] as { colaborador_id: string | null; data: string | null; indice: number | null }[], error: null }
        : await admin
            .from('indicadores_diarios')
            .select('colaborador_id, data, indice')
            .in('colaborador_id', idsAtivos)
            .in('data', dias)
    if (e2) throw e2

    // dia sem linha na view = nenhum apontamento = índice 0
    const porColaborador = new Map<string, Map<string, number>>()
    for (const ind of indicadores ?? []) {
      if (!ind.data || !ind.colaborador_id) continue
      const m = porColaborador.get(ind.colaborador_id) ?? new Map<string, number>()
      m.set(ind.data, ind.indice ?? 0)
      porColaborador.set(ind.colaborador_id, m)
    }

    // gestor não entra nas métricas de produtividade (não deixa de ser
    // destinatário do e-mail — ver uso de `ativos` abaixo pra achar `gestores`)
    const casos = (ativos ?? [])
      .filter((c) => c.role !== 'gestor')
      .map((c) => {
        const m = porColaborador.get(c.id)
        const indices = dias.map((dia) => m?.get(dia) ?? 0)
        return { nome: c.nome, indices }
      })
      .filter((c) => c.indices.every((i) => i < LIMITE))

    if (casos.length === 0) {
      return { casos: 0 }
    }

    const gestoresAtivos = (ativos ?? []).filter((c) => c.role === 'gestor' && c.notif_alerta_queda)
    const emails = await getEmailsPorId(admin, gestoresAtivos.map((g) => g.id))
    const gestores = gestoresAtivos.map((g) => emails.get(g.id)).filter((e): e is string => !!e)

    if (gestores.length === 0) {
      return { casos: casos.length, skipped: 'nenhum gestor com e-mail' }
    }

    const { subject, html } = emailAlertaQueda(casos, dias.map(formatarDataBR), remetenteNome)
    const result = await sendEmail({ to: gestores, subject, html, remetente: { nome: remetenteNome } })

    return { casos: casos.length, email: result }
  })

  return NextResponse.json({
    ok: resultados.every((r) => r.ok),
    dias,
    resultados,
  })
}
