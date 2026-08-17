import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { History, Layers } from 'lucide-react'

import { NovoApontamentoDialog } from './novo-apontamento-dialog'
import { LoteForm } from './lote/lote-form'
import { DailyProgressBlocks } from '@/components/charts/daily-progress-blocks'
import { HeatmapChart } from '@/components/charts/heatmap-chart'
import { buttonVariants } from '@/components/ui/button'
import type { DadosApontamento } from './carregar-apontamento'
import type { Role } from '@/lib/database.types'

/**
 * O lançamento diário, montado onde quer que ele precise aparecer.
 *
 * Nasceu como a página /apontamento inteira; virou componente quando Minha
 * semana passou a ser o hub — a lógica de lançar não mudou de lugar (continua
 * em actions.ts e no ApontamentoForm), só a moldura.
 *
 * `base` é a rota que hospeda o painel, para os links de modo apontarem para
 * a URL certa em vez de para /apontamento fixo.
 */
export function PainelApontamento({
  dados,
  usuarioId,
  cargaHorariaMin,
  role,
  emLote,
  base,
}: {
  dados: DadosApontamento
  usuarioId: string
  cargaHorariaMin: number
  role: Role
  emLote: boolean
  base: string
}) {
  const dataFormatada = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {emLote ? 'Lançar várias atividades' : 'Lançar o que foi concluído hoje'}
          </h2>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">{dataFormatada}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!emLote && (
            <NovoApontamentoDialog
              demandas={dados.demandas}
              cargaHorariaMin={cargaHorariaMin}
              tempoEntregueHoje={dados.tempoEntregueHoje}
              usuarioId={usuarioId}
              catalogoHref={role === 'gestor' ? '/gestao/catalogo' : '/minhas-demandas'}
              catalogoLabel={role === 'gestor' ? 'Abrir catálogo e equipe' : 'Sugerir nova demanda'}
            />
          )}
          <div className="flex h-9 items-center rounded-md border border-border bg-card p-1" aria-label="Modo de apontamento">
            <Link href={base} className={buttonVariants({ variant: emLote ? 'ghost' : 'default', size: 'xs' })}>
              Individual
            </Link>
            <Link href={`${base}?modo=lote`} className={buttonVariants({ variant: emLote ? 'default' : 'ghost', size: 'xs' })}>
              Em lote
            </Link>
          </div>
          {/* Histórico continua rota própria: é onde se edita e exclui
              lançamento de hoje, e embutir isso aqui transformaria o painel
              numa segunda tela dentro da tela. */}
          <Link href="/apontamento/historico" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <History className="h-4 w-4" /> Histórico
          </Link>
        </div>
      </div>

      {emLote ? (
        <div className="w-full max-w-3xl">
          <LoteForm demandas={dados.demandas} usuarioId={usuarioId} />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            O lote lança várias demandas de uma vez, todas com a data de hoje.
          </p>
        </div>
      ) : (
        /* Sem o formulário fixo, o que sobra na tela é o resultado do dia e o
           ritmo — lado a lado, porque agora há largura para os dois. */
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <DailyProgressBlocks
            apontamentos={dados.apontamentosDia}
            selectedDate={dados.dataSelecionada}
            cargaHorariaMin={cargaHorariaMin}
            compacto
          />
          <HeatmapChart dados={dados.indicadores} compacto />
        </div>
      )}
    </section>
  )
}
