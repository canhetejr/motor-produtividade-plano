'use client'

import { useState } from 'react'
import { LayoutGroup, motion, useMotionValueEvent } from 'framer-motion'
import { Check, CircleCheck, Clock, Zap } from 'lucide-react'

import { useMovimentoReduzido } from '@/lib/landing/movimento-reduzido'
import { cn } from '@/lib/utils'
import { useCapituloAtual } from './ato'

/**
 * O Kanban do Vértice, montando-se e depois operando.
 *
 * Por que o quadro legível é DOM e não geometria no canvas: texto dentro de
 * WebGL não é selecionável, não é lido por leitor de tela, não é indexado e não
 * respeita o tamanho de fonte do sistema. A cena 3D monta o esqueleto espacial
 * — as quatro colunas, os planos de cartão, a profundidade — e o produto de
 * verdade é desenhado por cima, nas mesmas coordenadas.
 *
 * A operação não é uma demonstração de funcionalidades enfileiradas. São
 * eventos acontecendo no tempo da leitura: um cartão muda de estágio, uma
 * automação dispara e fecha a checklist, alguém entra como responsável, uma
 * aprovação sai, um prazo vira alerta. Nenhum deles é anunciado por legenda —
 * o quadro está vivo, e é isso que precisa ser sentido.
 */

type Coluna = 'a-fazer' | 'andamento' | 'aprovacao' | 'concluido'

const COLUNAS: { id: Coluna; nome: string; limite?: string }[] = [
  { id: 'a-fazer', nome: 'A fazer' },
  { id: 'andamento', nome: 'Em andamento', limite: 'wip 5' },
  { id: 'aprovacao', nome: 'Aprovação' },
  { id: 'concluido', nome: 'Concluído' },
]

type Cartao = {
  id: string
  codigo: string
  titulo: string
  base: Coluna
  responsavel?: string
  prazo?: string
  urgente?: boolean
  etiqueta?: { nome: string; tom: 'acento' | 'neutro' | 'alerta' }
  checklist?: [number, number]
  progresso?: number
}

/** Dados fiéis aos campos que o produto realmente tem: código, título, área,
 *  responsável, prazo, prioridade, etiqueta, checklist e progresso. Nada aqui
 *  promete recurso que o Vértice não entrega. */
const CARTOES: Cartao[] = [
  {
    id: 'qead-142',
    codigo: 'QEAD-142',
    titulo: 'Revisar trilha de Matemática Básica',
    base: 'a-fazer',
    responsavel: 'MF',
    prazo: '12 ago',
    etiqueta: { nome: 'Conteúdo', tom: 'acento' },
  },
  {
    id: 'qead-147',
    codigo: 'QEAD-147',
    titulo: 'Padronizar capas dos módulos',
    base: 'a-fazer',
    responsavel: 'TR',
    etiqueta: { nome: 'Design', tom: 'neutro' },
  },
  {
    id: 'moodle-88',
    codigo: 'MOODLE-88',
    titulo: 'Migrar turmas do semestre para o novo ambiente',
    base: 'a-fazer',
    responsavel: 'LS',
    prazo: 'hoje',
    urgente: true,
    etiqueta: { nome: 'Operação', tom: 'alerta' },
    checklist: [2, 5],
    progresso: 34,
  },
  {
    id: 'qead-151',
    codigo: 'QEAD-151',
    titulo: 'Atualizar banco de questões do módulo 3',
    base: 'andamento',
    responsavel: 'WN',
    prazo: '15 ago',
    progresso: 62,
  },
  {
    id: 'qead-139',
    codigo: 'QEAD-139',
    titulo: 'Ajustar rubrica de correção',
    base: 'andamento',
    prazo: '10 ago',
    etiqueta: { nome: 'Conteúdo', tom: 'acento' },
  },
  {
    id: 'qead-131',
    codigo: 'QEAD-131',
    titulo: 'Roteiro do vídeo de abertura',
    base: 'aprovacao',
    responsavel: 'AB',
    etiqueta: { nome: 'Audiovisual', tom: 'neutro' },
  },
  {
    id: 'qead-128',
    codigo: 'QEAD-128',
    titulo: 'Publicar banco de questões',
    base: 'concluido',
    responsavel: 'WN',
  },
]

/**
 * Momentos da operação, em ordem de leitura. Ligados à rolagem e não a um
 * temporizador: quem controla o ritmo dos eventos é quem está lendo.
 *
 * Medidos no relógio `visivel` do capítulo. Este capítulo cobre dois atos
 * (3,45 viewports), então o quadro fica grudado na tela durante `visivel` de
 * ~0,22 a ~0,78 — é dentro dessa faixa que os cinco eventos precisam caber,
 * senão o último dispara com o painel já saindo de quadro.
 */
const MOMENTOS = [0.36, 0.44, 0.52, 0.6, 0.68] as const

function faseDe(p: number) {
  let f = 0
  for (const m of MOMENTOS) if (p >= m) f++
  return f
}

/** Onde cada cartão está, dada a fase. A única coisa que muda de fase para
 *  fase é o destino — o cartão é sempre o mesmo elemento, e é por isso que ele
 *  viaja entre as colunas em vez de sumir de um lado e nascer do outro. */
function colunaDe(c: Cartao, fase: number): Coluna {
  if (c.id === 'moodle-88' && fase >= 1) return 'andamento'
  if (c.id === 'qead-131' && fase >= 4) return 'concluido'
  return c.base
}

export function QuadroVivo() {
  const { visivel } = useCapituloAtual()
  const reduzir = useMovimentoReduzido()
  const [montados, setMontados] = useState(0)
  const [fase, setFase] = useState(0)

  useMotionValueEvent(visivel, 'change', (v) => {
    if (reduzir) return
    // A montagem acontece durante a entrada do quadro, terminando antes do
    // primeiro evento da operação. O estado muda umas poucas vezes no total — o
    // resto do movimento é transição de CSS, sem re-render por quadro.
    const n = Math.round(Math.min(Math.max((v - 0.13) / 0.18, 0), 1) * CARTOES.length)
    setMontados((prev) => (prev === n ? prev : n))
    setFase((prev) => {
      const f = faseDe(v)
      return prev === f ? prev : f
    })
  })

  // Derivado no render: com movimento reduzido o quadro já aparece montado e
  // com a operação concluída — o mesmo conteúdo, sem o percurso.
  const montadosAgora = reduzir ? CARTOES.length : montados
  const faseAgora = reduzir ? MOMENTOS.length : fase

  // Ordem de montagem espacial: coluna a coluna, de cima para baixo. O atraso
  // segue a posição no espaço, não o índice no array — é o que faz o quadro
  // parecer se erguendo em vez de uma lista aparecendo em cascata.
  const ordemEspacial = new Map<string, number>()
  COLUNAS.forEach((col, ci) => {
    CARTOES.filter((c) => colunaDe(c, faseAgora) === col.id).forEach((c, ri) => {
      ordemEspacial.set(c.id, ci * 1.6 + ri)
    })
  })
  const ordenados = [...ordemEspacial.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)

  return (
    <LayoutGroup>
      <div
        className="rounded-md border border-white/10 bg-[#08070f]/80 p-3 backdrop-blur-md sm:p-4"
        style={{ perspective: '1200px' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <span className="font-mono text-3xs text-white/35">vertice.app / quadros / Qualidade EAD</span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-mono text-4xs uppercase transition-colors duration-500',
              faseAgora >= 2 ? 'text-primary' : 'text-white/25'
            )}
          >
            <Zap className="size-3" aria-hidden />
            {faseAgora >= 2 ? 'automação executada' : 'automações ativas'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {COLUNAS.map((col) => {
            const cartoes = CARTOES.filter((c) => colunaDe(c, faseAgora) === col.id)
            return (
              <div key={col.id} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <span className="truncate text-2xs font-semibold text-white/75">{col.nome}</span>
                  <span className="shrink-0 font-mono text-4xs tabular-nums text-white/30">
                    {col.limite ? `${cartoes.length}/${col.limite.slice(4)}` : cartoes.length}
                  </span>
                </div>
                <div className="flex min-h-[3rem] flex-col gap-2">
                  {cartoes.map((c) => (
                    <CartaoQuadro
                      key={c.id}
                      cartao={c}
                      fase={faseAgora}
                      montado={ordenados.indexOf(c.id) < montadosAgora}
                      reduzir={!!reduzir}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </LayoutGroup>
  )
}

const TOM = {
  acento: 'text-primary bg-primary/12',
  neutro: 'text-white/70 bg-white/8',
  alerta: 'text-warning-texto bg-warning-superficie',
} as const

function CartaoQuadro({
  cartao,
  fase,
  montado,
  reduzir,
}: {
  cartao: Cartao
  fase: number
  montado: boolean
  reduzir: boolean
}) {
  // Cada evento da operação toca um cartão específico. Nenhum deles é
  // anunciado — o estado simplesmente muda, como mudaria no produto.
  const automatizado = cartao.id === 'moodle-88' && fase >= 2
  const checklist: [number, number] | undefined = automatizado ? [5, 5] : cartao.checklist
  const progresso = automatizado ? 100 : cartao.progresso
  const responsavel = cartao.id === 'qead-139' && fase >= 3 ? 'CF' : cartao.responsavel
  const aprovado = cartao.id === 'qead-131' && fase >= 4
  const prazoCritico = cartao.id === 'qead-142' && fase >= 5
  const destacado = (cartao.id === 'moodle-88' && fase >= 1 && fase < 3) || aprovado

  return (
    <motion.article
      layout={!reduzir}
      layoutId={reduzir ? undefined : cartao.id}
      transition={{ type: 'spring', stiffness: 210, damping: 26, mass: 0.9 }}
      data-montado={montado || reduzir}
      className={cn(
        'group/cartao rounded-md border p-2.5 transition-[opacity,transform,border-color,box-shadow] duration-700 ease-[cubic-bezier(.16,1,.3,1)]',
        'border-white/10 bg-white/[0.045]',
        destacado && 'border-primary/45 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary),transparent_70%)]',
        // Entrada em profundidade, não fade-up: o cartão chega de trás no
        // mesmo eixo em que a câmera da cena avança.
        'data-[montado=false]:pointer-events-none data-[montado=false]:opacity-0',
        'data-[montado=false]:[transform:translate3d(0,18px,-160px)_rotateX(-14deg)]',
        'data-[montado=true]:opacity-100 data-[montado=true]:[transform:none]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-4xs tabular-nums text-white/35">{cartao.codigo}</span>
        {cartao.urgente && !automatizado && (
          <span className="rounded-sm bg-danger-superficie px-1 py-px font-mono text-4xs font-bold uppercase text-danger-texto">
            urgente
          </span>
        )}
        {aprovado && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-4xs uppercase text-primary">
            <CircleCheck className="size-2.5" aria-hidden />
            aprovado
          </span>
        )}
      </div>

      <p className="mt-1 text-2xs font-medium leading-snug text-white/90">{cartao.titulo}</p>

      {cartao.etiqueta && (
        <span className={cn('mt-1.5 inline-block rounded-sm px-1.5 py-px text-4xs font-semibold', TOM[cartao.etiqueta.tom])}>
          {cartao.etiqueta.nome}
        </span>
      )}

      {checklist && (
        <div className="mt-2 flex items-center gap-1.5">
          <Check
            className={cn('size-3 transition-colors duration-500', checklist[0] === checklist[1] ? 'text-primary' : 'text-white/35')}
            aria-hidden
          />
          <span className="font-mono text-4xs tabular-nums text-white/45">
            {checklist[0]}/{checklist[1]}
          </span>
        </div>
      )}

      {progresso !== undefined && (
        <span className="mt-2 block h-0.5 overflow-hidden rounded-full bg-white/10">
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(.16,1,.3,1)]',
              progresso === 100 ? 'bg-primary' : 'bg-white/40'
            )}
            style={{ width: `${progresso}%` }}
          />
        </span>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex size-4 items-center justify-center rounded-full font-mono text-4xs font-bold transition-opacity duration-500',
            responsavel ? 'bg-primary/25 text-white/85 opacity-100' : 'border border-dashed border-white/20 opacity-60'
          )}
        >
          {responsavel ?? ''}
        </span>
        {cartao.prazo && (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-mono text-4xs tabular-nums transition-colors duration-500',
              prazoCritico || cartao.prazo === 'hoje' ? 'text-warning-texto' : 'text-white/35'
            )}
          >
            {(prazoCritico || cartao.prazo === 'hoje') && <Clock className="size-2.5" aria-hidden />}
            {cartao.prazo}
          </span>
        )}
      </div>
    </motion.article>
  )
}
