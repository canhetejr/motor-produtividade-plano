import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cronAuthorized, getEmailsPorId, tentarReservarExecucao, paraCadaOrganizacao } from '@/lib/cron'
import { sendEmail, emailRelatorioSemanal } from '@/lib/email'
import {
  inicioSemana,
  diasUteisAnteriores,
  diasUteisEntre,
  formatarDataCompletaBR,
} from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Vercel Cron: 0 11 * * 1 (segunda, 8h em Maringá) — resumo da semana anterior.
// Roda por organização, com try/catch independente por organização (via
// paraCadaOrganizacao).
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Sexta passada e a segunda daquela mesma semana
  const fim = diasUteisAnteriores(1, inicioSemana())[0]
  const inicio = inicioSemana(fim)
  const diasUteis = Math.max(1, diasUteisEntre(inicio, fim))

  const resultados = await paraCadaOrganizacao(admin, async (organizacaoId) => {
    if (!(await tentarReservarExecucao(admin, 'relatorio-semanal', organizacaoId, `${inicio}_${fim}`))) {
      return { skipped: 'já executado' }
    }

    const [
      { data: colaboradores, error: e1 },
      { data: areas, error: e2 },
      { data: indicadores, error: e3 },
    ] = await Promise.all([
      admin
        .from('colaboradores')
        .select('id, nome, area_id, carga_horaria_min, role, notif_relatorio_semanal')
        .eq('organizacao_id', organizacaoId)
        .eq('ativo', true),
      admin.from('areas').select('id, nome').eq('organizacao_id', organizacaoId),
      admin
        .from('indicadores_diarios')
        .select('colaborador_id, tempo_entregue_min')
        .eq('organizacao_id', organizacaoId)
        .gte('data', inicio)
        .lte('data', fim),
    ])
    if (e1 || e2 || e3) throw e1 ?? e2 ?? e3

    const tempoPor = new Map<string, number>()
    for (const ind of indicadores ?? []) {
      tempoPor.set(ind.colaborador_id, (tempoPor.get(ind.colaborador_id) ?? 0) + ind.tempo_entregue_min)
    }

    // gestor não entra nas métricas de produtividade (continua recebendo o
    // e-mail — ver uso de `colaboradores` abaixo pra achar `gestores`)
    const porColaborador = (colaboradores ?? [])
      .filter((c) => c.role !== 'gestor')
      .map((c) => {
        const tempo = tempoPor.get(c.id) ?? 0
        const carga = diasUteis * c.carga_horaria_min
        return {
          nome: c.nome,
          area_id: c.area_id,
          tempo,
          carga,
          indice: carga > 0 ? tempo / carga : 0,
        }
      })
      .sort((a, b) => b.indice - a.indice)

    // Ponderado por carga horária (soma tempo / soma carga), não média
    // simples dos índices individuais — senão 1 pessoa em 150% pesa igual a
    // 1 pessoa em 40%, mascarando o desempenho agregado real da área.
    const somaArea = new Map<string, { tempo: number; carga: number }>()
    for (const c of porColaborador) {
      if (!c.area_id) continue
      const cur = somaArea.get(c.area_id) ?? { tempo: 0, carga: 0 }
      cur.tempo += c.tempo
      cur.carga += c.carga
      somaArea.set(c.area_id, cur)
    }
    const porArea = Array.from(somaArea.entries())
      .map(([areaId, { tempo, carga }]) => ({
        area: areas?.find((a) => a.id === areaId)?.nome ?? '—',
        indice: carga > 0 ? tempo / carga : 0,
      }))
      .sort((a, b) => b.indice - a.indice)

    const gestoresAtivos = (colaboradores ?? []).filter((c) => c.role === 'gestor' && c.notif_relatorio_semanal)
    const emails = await getEmailsPorId(admin, gestoresAtivos.map((g) => g.id))
    const gestores = gestoresAtivos.map((g) => emails.get(g.id)).filter((e): e is string => !!e)

    if (gestores.length === 0) {
      return { skipped: 'nenhum gestor com e-mail' }
    }

    const { subject, html } = emailRelatorioSemanal({
      inicio: formatarDataCompletaBR(inicio),
      fim: formatarDataCompletaBR(fim),
      porArea,
      porColaborador: porColaborador.map(({ nome, tempo, indice }) => ({ nome, tempo, indice })),
    })
    const result = await sendEmail({ to: gestores, subject, html })

    return { email: result }
  })

  return NextResponse.json({
    ok: resultados.every((r) => r.ok),
    inicio,
    fim,
    resultados,
  })
}
