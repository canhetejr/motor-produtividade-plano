import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, getEmailMap } from '@/lib/cron'
import { sendEmail, emailLembrete } from '@/lib/email'
import { hoje, ehDiaUtil } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Vercel Cron: 0 21 * * 1-5 (18h em Maringá) — lembra quem não apontou hoje.
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ehDiaUtil()) {
    return NextResponse.json({ ok: true, skipped: 'fim de semana' })
  }

  try {
    const admin = createAdminClient()
    const dia = hoje()

    const [{ data: ativos, error: e1 }, { data: apontados, error: e2 }] = await Promise.all([
      admin.from('colaboradores').select('id, nome').eq('ativo', true),
      admin.from('apontamentos').select('colaborador_id').eq('data', dia),
    ])
    if (e1 || e2) throw e1 ?? e2

    const jaApontou = new Set((apontados ?? []).map((a) => a.colaborador_id))
    const pendentes = (ativos ?? []).filter((c) => !jaApontou.has(c.id))

    if (pendentes.length === 0) {
      return NextResponse.json({ ok: true, dia, enviados: [], msg: 'todos apontaram' })
    }

    const emails = await getEmailMap(admin)
    const enviados = await Promise.all(
      pendentes.map(async (c) => {
        const to = emails.get(c.id)
        if (!to) return { colaborador: c.nome, sent: false as const, error: 'sem e-mail' }
        const { subject, html } = emailLembrete(c.nome)
        const result = await sendEmail({ to, subject, html })
        return { colaborador: c.nome, ...result }
      })
    )

    return NextResponse.json({ ok: true, dia, enviados })
  } catch (err) {
    console.error('[cron lembrete-diario]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
