import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, getEmailMap, tentarReservarExecucao } from '@/lib/cron'
import { sendEmail, emailAlertaQueda } from '@/lib/email'
import { diasUteisAnteriores, formatarDataBR } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const LIMITE = 0.7

// Vercel Cron: 0 11 * * 1-5 (8h em Maringá) — alerta gestores sobre quem
// ficou abaixo de 70% nos 2 últimos dias úteis.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const dias = diasUteisAnteriores(2)

    if (!(await tentarReservarExecucao(admin, 'alerta-queda', dias.join(',')))) {
      return NextResponse.json({ ok: true, dias, skipped: 'já executado' })
    }

    const [{ data: ativos, error: e1 }, { data: indicadores, error: e2 }] = await Promise.all([
      admin.from('colaboradores').select('id, nome, role, notif_alerta_queda').eq('ativo', true),
      admin
        .from('indicadores_diarios')
        .select('colaborador_id, data, indice')
        .in('data', dias),
    ])
    if (e1 || e2) throw e1 ?? e2

    // dia sem linha na view = nenhum apontamento = índice 0
    const porColaborador = new Map<string, Map<string, number>>()
    for (const ind of indicadores ?? []) {
      if (!ind.data) continue
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
      return NextResponse.json({ ok: true, dias, casos: 0 })
    }

    const emails = await getEmailMap(admin)
    const gestores = (ativos ?? [])
      .filter((c) => c.role === 'gestor' && c.notif_alerta_queda)
      .map((g) => emails.get(g.id))
      .filter((e): e is string => !!e)

    if (gestores.length === 0) {
      return NextResponse.json({ ok: true, dias, casos: casos.length, skipped: 'nenhum gestor com e-mail' })
    }

    const { subject, html } = emailAlertaQueda(casos, dias.map(formatarDataBR))
    const result = await sendEmail({ to: gestores, subject, html })

    return NextResponse.json({ ok: true, dias, casos: casos.length, email: result })
  } catch (err) {
    console.error('[cron alerta-queda]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
