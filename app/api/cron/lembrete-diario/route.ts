import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, getEmailsPorId, tentarReservarExecucao, paraCadaOrganizacao } from '@/lib/cron'
import { sendEmail, emailLembrete } from '@/lib/email'
import { hoje, ehDiaUtil } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Vercel Cron: 0 21 * * 1-5 (18h em Maringá) — lembra quem não apontou hoje.
//
// Roda por organização: cada uma reserva sua própria chave de idempotência e
// tem seu próprio try/catch (via paraCadaOrganizacao) — dado ruim numa
// organização não pode impedir o lembrete das demais.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ehDiaUtil()) {
    return NextResponse.json({ ok: true, skipped: 'fim de semana' })
  }

  const admin = createAdminClient()
  const dia = hoje()

  const resultados = await paraCadaOrganizacao(admin, async (organizacaoId) => {
    if (!(await tentarReservarExecucao(admin, 'lembrete-diario', organizacaoId, dia))) {
      return { skipped: 'já executado hoje' }
    }

    const [{ data: ativos, error: e1 }, { data: apontados, error: e2 }] = await Promise.all([
      admin
        .from('colaboradores')
        .select('id, nome')
        .eq('organizacao_id', organizacaoId)
        .eq('ativo', true)
        .eq('notif_lembrete_diario', true),
      admin
        .from('apontamentos')
        .select('colaborador_id')
        .eq('organizacao_id', organizacaoId)
        .eq('data', dia),
    ])
    if (e1 || e2) throw e1 ?? e2

    const jaApontou = new Set((apontados ?? []).map((a) => a.colaborador_id))
    const pendentes = (ativos ?? []).filter((c) => !jaApontou.has(c.id))

    if (pendentes.length === 0) {
      return { enviados: [], msg: 'todos apontaram' }
    }

    const emails = await getEmailsPorId(admin, pendentes.map((c) => c.id))
    const enviados = await Promise.all(
      pendentes.map(async (c) => {
        const to = emails.get(c.id)
        if (!to) return { colaborador: c.nome, sent: false as const, error: 'sem e-mail' }
        const { subject, html } = emailLembrete(c.nome)
        const result = await sendEmail({ to, subject, html })
        return { colaborador: c.nome, ...result }
      })
    )

    return { enviados }
  })

  return NextResponse.json({
    ok: resultados.every((r) => r.ok),
    dia,
    resultados,
  })
}
