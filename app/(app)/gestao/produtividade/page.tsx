import { Timer } from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'

import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { hoje, inicioSemana, inicioMes } from '@/lib/dates'
import { formatarTempo } from '@/lib/tempo'
import {
  produtividadeDe,
  faixaDe,
  formatarProdutividade,
  reguaDeComplexidade,
  ROTULO_FAIXA,
  type Medicao,
} from '@/lib/produtividade'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { ProdutividadeBadge, CLASSE_FAIXA } from '@/components/ui/produtividade-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DashboardFilters } from '../../dashboard/dashboard-filters'
import { ReguaComplexidade } from './regua-complexidade'

export const dynamic = 'force-dynamic'

/**
 * Produtividade: quanto do tempo esperado a equipe gastou de verdade.
 *
 * Página separada de /gestao de propósito. O índice de lá responde "a jornada
 * foi ocupada?" e é lido todo dia; este número responde "no tempo que se
 * esperava?" e ainda está sendo validado. Empilhar os dois na mesma tela faria
 * o gestor comparar percentuais que não medem a mesma coisa.
 */
function inicioDoPeriodo(period: string, hojeIso: string): string {
  if (period === 'week') return inicioSemana()
  if (period === 'month') return inicioMes()
  const dias: Record<string, number> = { last7: 7, last15: 15, last30: 30, last90: 90, last180: 180 }
  const n = dias[period]
  if (n) return format(subDays(parseISO(hojeIso), n), 'yyyy-MM-dd')
  return hojeIso
}

export default async function ProdutividadePage(props: {
  searchParams: Promise<{ period?: string; area?: string }>
}) {
  await requireGestor()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // Padrão de 30 dias, e não "hoje" como o dashboard: produtividade de um dia
  // só costuma ser uma execução ou nenhuma, e um painel que abre vazio na
  // maioria das vezes não é lido de novo.
  const period = searchParams.period || 'last30'
  const areaFiltro = searchParams.area || 'all'

  const hojeIso = hoje()
  const inicioIso = inicioDoPeriodo(period, hojeIso)

  const [
    { data: execucoes, error: execucoesError },
    { data: areas, error: areasError },
    { data: demandas, error: demandasError },
    { data: colaboradores, error: colaboradoresError },
    { data: apontamentosPeriodo },
    { data: niveis },
  ] = await Promise.all([
    supabase
      .from('produtividade_execucoes')
      .select('demanda_id, colaborador_id, area_id, origem, tempo_esperado_min, tempo_real_min')
      .gte('data', inicioIso)
      .lte('data', hojeIso),
    supabase.from('areas').select('id, nome').order('nome'),
    supabase.from('demandas').select('id, nome, area_id, variavel'),
    supabase.from('colaboradores').select('id, nome, area_id, ativo'),
    // Denominador da cobertura: quantas entregas houve no período, medidas ou
    // não. Sem isso, "132%" some do contexto de ter vindo de três execuções.
    supabase
      .from('apontamentos')
      .select('id', { count: 'exact', head: false })
      .gte('data', inicioIso)
      .lte('data', hojeIso),
    supabase.from('complexidade_niveis').select('nivel, minutos_referencia'),
  ])
  throwIfError(areasError, demandasError, colaboradoresError)
  // A tabela é nova: se a migration ainda não rodou neste ambiente, a página
  // mostra o estado vazio em vez de derrubar a navegação inteira do gestor.
  if (execucoesError) {
    console.error(
      'Falha ao carregar execuções de produtividade: code=%s message=%s',
      execucoesError.code,
      execucoesError.message
    )
  }

  const nomeDemanda = new Map((demandas ?? []).map((d) => [d.id, d.nome]))
  const nomeArea = new Map((areas ?? []).map((a) => [a.id, a.nome]))
  const nomeColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nome]))

  // As colunas do banco viram os nomes de `Medicao` aqui, e não no módulo:
  // `lib/produtividade.ts` é puro de propósito, sem forma de tabela dentro.
  type Execucao = Medicao & {
    demanda_id: string
    colaborador_id: string
    area_id: string
    origem: string
  }
  const doPeriodo: Execucao[] = (execucoes ?? [])
    .filter((e) => areaFiltro === 'all' || e.area_id === areaFiltro)
    .map((e) => ({
      demanda_id: e.demanda_id,
      colaborador_id: e.colaborador_id,
      area_id: e.area_id,
      origem: e.origem,
      esperado_min: e.tempo_esperado_min,
      real_min: e.tempo_real_min,
    }))

  const geral = produtividadeDe(doPeriodo)
  const faixaGeral = faixaDe(geral)

  type Agregado = { chave: string; execucoes: Execucao[]; areaId: string }
  function agrupar(por: 'demanda_id' | 'colaborador_id'): Agregado[] {
    const mapa = new Map<string, Agregado>()
    for (const e of doPeriodo) {
      const chave = e[por]
      const atual = mapa.get(chave) ?? { chave, execucoes: [], areaId: e.area_id }
      atual.execucoes.push(e)
      mapa.set(chave, atual)
    }
    return [...mapa.values()].sort((a, b) => {
      // Piores primeiro: é onde há o que fazer. Sem medição vai para o fim —
      // não é um resultado ruim, é ausência de resultado.
      const pa = produtividadeDe(a.execucoes) ?? Number.POSITIVE_INFINITY
      const pb = produtividadeDe(b.execucoes) ?? Number.POSITIVE_INFINITY
      return pa - pb
    })
  }

  const porDemanda = agrupar('demanda_id')
  const porColaborador = agrupar('colaborador_id')

  const totalApontamentos = (apontamentosPeriodo ?? []).length
  const medidasDeApontamento = doPeriodo.filter((e) => e.origem === 'apontamento').length
  const cobertura = totalApontamentos > 0 ? medidasDeApontamento / totalApontamentos : null

  const esperadoTotal = doPeriodo.reduce((acc, e) => acc + e.esperado_min, 0)
  const realTotal = doPeriodo.reduce((acc, e) => acc + e.real_min, 0)

  return (
    <PageShell contentClassName="space-y-6">
      <PageHeader
        title="Produtividade"
        description="Tempo esperado sobre tempo real. Acima de 100% significa entregar mais rápido que a régua da demanda."
        icon={Timer}
        level={2}
      />

      <DashboardFilters areas={areas ?? []} currentPeriod={period} currentArea={areaFiltro} />

      {doPeriodo.length === 0 ? (
        <EmptyState
          icone={Timer}
          titulo="Nenhuma execução medida ainda"
          descricao="Informe o tempo gasto ao lançar uma demanda de tempo padrão, ou defina o nível de complexidade das de tempo variável, para começar a medir."
        />
      ) : (
        <>
          {/* Um número dominante, não uma grade de valores de mesmo peso. */}
          <section className="rounded-md border border-border bg-card p-6 shadow-xs">
            <p className="font-mono text-3xs uppercase tracking-[0.14em] text-muted-foreground">
              Produtividade da equipe
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              {/* 30px: o teto de KPI do design.md. Maior que isso o número
                  vira cartaz e some a hierarquia com o resto da página. */}
              <span className={`font-mono text-3xl font-semibold tabular-nums ${CLASSE_FAIXA[faixaGeral].texto}`}>
                {formatarProdutividade(geral)}
              </span>
              <span className={`text-sm font-medium ${CLASSE_FAIXA[faixaGeral].texto}`}>
                {ROTULO_FAIXA[faixaGeral]}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {doPeriodo.length} {doPeriodo.length === 1 ? 'execução medida' : 'execuções medidas'} ·{' '}
              {formatarTempo(esperadoTotal)} esperados contra {formatarTempo(realTotal)} reais
            </p>
            {cobertura !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {/* O número honesto ao lado do bonito: 132% vindo de três
                    medições em quarenta lançamentos não é a equipe, é a
                    amostra. */}
                Cobertura: {Math.round(cobertura * 100)}% dos lançamentos do período têm tempo gasto
                informado.
              </p>
            )}
          </section>

          <TabelaProdutividade
            titulo="Por demanda"
            descricao="Demanda com produtividade muito alta ou muito baixa costuma ser régua mal calibrada, não pessoa."
            linhas={porDemanda.map((g) => ({
              chave: g.chave,
              nome: nomeDemanda.get(g.chave) ?? 'Demanda removida',
              contexto: nomeArea.get(g.areaId) ?? '—',
              execucoes: g.execucoes,
            }))}
          />

          <TabelaProdutividade
            titulo="Por colaborador"
            descricao="Mesma demanda, tempos diferentes: é aqui que aparece quem executa mais rápido."
            linhas={porColaborador.map((g) => ({
              chave: g.chave,
              nome: nomeColaborador.get(g.chave) ?? 'Colaborador removido',
              contexto: nomeArea.get(g.areaId) ?? '—',
              execucoes: g.execucoes,
            }))}
          />
        </>
      )}

      <ReguaComplexidade minutosPorNivel={reguaDeComplexidade(niveis)} />
    </PageShell>
  )
}

function TabelaProdutividade({
  titulo,
  descricao,
  linhas,
}: {
  titulo: string
  descricao: string
  linhas: Array<{ chave: string; nome: string; contexto: string; execucoes: Medicao[] }>
}) {
  if (linhas.length === 0) return null

  return (
    <section className="rounded-md border border-border bg-card p-5 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-3xs uppercase tracking-[0.1em] text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Nome</th>
              <th className="pb-2 pr-3 font-medium">Área</th>
              <th className="pb-2 pr-3 text-right font-medium">Execuções</th>
              <th className="pb-2 pr-3 text-right font-medium">Esperado</th>
              <th className="pb-2 pr-3 text-right font-medium">Real</th>
              <th className="pb-2 text-right font-medium">Produtividade</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const p = produtividadeDe(l.execucoes)
              const esperado = l.execucoes.reduce((acc, e) => acc + e.esperado_min, 0)
              const real = l.execucoes.reduce((acc, e) => acc + e.real_min, 0)
              return (
                <tr key={l.chave} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{l.nome}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{l.contexto}</td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {l.execucoes.length}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatarTempo(esperado)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatarTempo(real)}
                  </td>
                  <td className="py-2.5 text-right">
                    <ProdutividadeBadge produtividade={p} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
