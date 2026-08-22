'use client'

import { useState } from 'react'
import { useMotionValueEvent, useTransform } from 'framer-motion'

import { useMovimentoReduzido } from '@/lib/landing/movimento-reduzido'
import { JANELA_DADOS } from '@/lib/landing/movimento'
import { cn } from '@/lib/utils'
import { useCapituloAtual } from './ato'

/**
 * Número que entra em alinhamento conforme a cena avança.
 *
 * Em JetBrains Mono com `tabular-nums` — sem isso a largura de cada dígito muda
 * durante a contagem e o número treme no lugar, que é o detalhe que separa um
 * contador bem feito de um contador de template.
 *
 * O valor é ligado à rolagem, não a um timer: o número não "conta sozinho ao
 * aparecer", ele acompanha a leitura. Parar de rolar para o número no lugar.
 */
export function Numero({
  de = 0,
  ate,
  sufixo = '',
  decimais = 0,
  inicio = JANELA_DADOS.inicio,
  fim = JANELA_DADOS.fim,
  className,
}: {
  de?: number
  ate: number
  sufixo?: string
  decimais?: number
  inicio?: number
  fim?: number
  className?: string
}) {
  const { visivel } = useCapituloAtual()
  const reduzir = useMovimentoReduzido()
  const valor = useTransform(visivel, [inicio, fim], [de, ate], { clamp: true })
  // O estado inicial não pode consultar `reduzir`: no servidor a preferência é
  // sempre "movimento normal", e um valor diferente no primeiro render do
  // cliente faria o texto hidratado divergir do texto entregue. Por isso a
  // contagem começa sempre em `de`, e quem pediu menos movimento recebe o valor
  // final por derivação no render — `useMovimentoReduzido` é um
  // `useSyncExternalStore` com retrato de servidor, então o React re-renderiza
  // depois da hidratação em vez de acusar divergência.
  const [texto, setTexto] = useState(() => de.toFixed(decimais))

  useMotionValueEvent(valor, 'change', (v) => {
    if (!reduzir) setTexto(v.toFixed(decimais))
  })

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {reduzir ? ate.toFixed(decimais) : texto}
      {sufixo}
    </span>
  )
}

/**
 * Rótulo técnico: `01`, `STATUS`, `x 128%`.
 *
 * O contraponto pequeno e preciso às manchetes grandes. Caixa-alta aqui é uma
 * das exceções que docs/design/system.md §3 permite — código e estado muito curto —, e o
 * mono é o que já marca dado no resto do produto. Sem isso a página teria só
 * dois tamanhos de voz; com isso ela ganha o registro técnico que faz a
 * composição parecer instrumentada em vez de decorada.
 */
export function Rotulo({
  children,
  numero,
  className,
  acento = false,
}: {
  children?: React.ReactNode
  numero?: string
  className?: string
  acento?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono text-3xs uppercase',
        acento ? 'text-primary' : 'text-white/40',
        className
      )}
    >
      {numero && (
        <>
          <span className="tabular-nums">{numero}</span>
          <span aria-hidden className="h-px w-6 bg-current opacity-40" />
        </>
      )}
      {children}
    </span>
  )
}

/**
 * Barra que se completa com a leitura. Usada onde o dado É a mensagem
 * (capacidade, progresso), então ela precisa chegar ao valor final enquanto o
 * texto ao lado ainda está sendo lido, e não depois.
 */
export function Medidor({
  valor,
  teto = 130,
  acento = false,
  className,
  inicio = JANELA_DADOS.inicio,
  fim = JANELA_DADOS.fim,
}: {
  valor: number
  teto?: number
  acento?: boolean
  className?: string
  inicio?: number
  fim?: number
}) {
  const { visivel } = useCapituloAtual()
  const reduzir = useMovimentoReduzido()
  const alvo = Math.min(valor / teto, 1) * 100
  const largura = useTransform(visivel, [inicio, fim], [0, alvo], { clamp: true })
  // Sempre 0 no primeiro render, pelo mesmo motivo do contador acima.
  const [pct, setPct] = useState(0)

  useMotionValueEvent(largura, 'change', (v) => {
    if (!reduzir) setPct(v)
  })

  return (
    <span className={cn('block h-1 overflow-hidden rounded-full bg-white/10', className)}>
      <span
        className={cn('block h-full rounded-full', acento ? 'bg-primary' : 'bg-white/45')}
        style={{ width: `${(reduzir ? alvo : pct).toFixed(2)}%` }}
      />
    </span>
  )
}
