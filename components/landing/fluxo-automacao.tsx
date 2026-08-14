'use client'

import { useState } from 'react'
import { useMotionValueEvent } from 'framer-motion'
import { Bell, CalendarCheck, CircleCheck, FileInput, FileText, Workflow } from 'lucide-react'

import { useMovimentoReduzido } from '@/lib/landing/movimento-reduzido'
import { cn } from '@/lib/utils'
import { useCapituloAtual } from './ato'

/**
 * A cadeia da automação: cartão → regra → responsável → aprovação → calendário
 * → relatório.
 *
 * Não é um fluxograma. Um fluxograma explica um processo para quem está de
 * fora; aqui a intenção é mostrar o sistema executando — cada etapa acende
 * quando o pulso chega nela, na mesma ordem em que a cena 3D percorre as
 * conexões entre os seis núcleos atrás deste bloco.
 *
 * Os ícones são os mesmos que o produto usa nas telas correspondentes, para que
 * a cadeia leia como partes de um software só e não como um diagrama genérico.
 */

/** As seis etapas são as seis funcionalidades que a landing sempre anunciou,
 *  reordenadas na sequência em que o sistema realmente as executa. Nada foi
 *  inventado e nada saiu: o que muda é que agora elas formam uma cadeia em vez
 *  de uma grade de cartões de recurso. */
const ETAPAS = [
  {
    icone: FileInput,
    titulo: 'Formulário',
    detalhe: 'Demanda de fora da equipe entra por um link e vira cartão no quadro.',
  },
  {
    icone: Workflow,
    titulo: 'Automação',
    detalhe: 'Regras movem o cartão, avisam o responsável e disparam checklist sem ninguém lembrar.',
  },
  {
    icone: Bell,
    titulo: 'Alerta',
    detalhe: 'Prazo curto e queda de produtividade viram notificação e push, não descoberta tardia.',
  },
  {
    icone: CircleCheck,
    titulo: 'Aprovação',
    detalhe: 'Horas fora do padrão e entregas sensíveis passam por aprovação, com trilha de quem decidiu.',
  },
  {
    icone: CalendarCheck,
    titulo: 'Calendário',
    detalhe: 'Prazo de cartão vira evento na agenda de quem é responsável, atualizado sozinho.',
  },
  {
    icone: FileText,
    titulo: 'Relatório',
    detalhe: 'O resumo da semana sai no dia e para a lista que você definir.',
  },
] as const

export function FluxoAutomacao({ className }: { className?: string }) {
  const { visivel } = useCapituloAtual()
  const reduzir = useMovimentoReduzido()
  const [ativas, setAtivas] = useState(0)

  useMotionValueEvent(visivel, 'change', (v) => {
    if (reduzir) return
    // O pulso percorre a cadeia durante a entrada do bloco, fechando enquanto
    // ele ainda está bem enquadrado.
    const n = Math.round(Math.min(Math.max((v - 0.14) / 0.3, 0), 1) * ETAPAS.length)
    setAtivas((prev) => (prev === n ? prev : n))
  })

  // Derivado no render: com movimento reduzido a cadeia já aparece inteira
  // acesa, sem um render extra só para chegar lá.
  const acesas = reduzir ? ETAPAS.length : ativas

  return (
    <ol className={cn('grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/[0.07] sm:grid-cols-3', className)}>
      {ETAPAS.map((etapa, i) => {
        const Icone = etapa.icone
        const ativa = i < acesas
        return (
          <li
            key={etapa.titulo}
            data-ativa={ativa}
            className={cn(
              'relative bg-[#08070f] p-4 transition-colors duration-500',
              'data-[ativa=true]:bg-[#0b0a16]'
            )}
          >
            {/* A linha de progresso no topo é o pulso chegando — mesma
                linguagem das conexões da cena, em duas dimensões. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px origin-left bg-primary transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{ transform: `scaleX(${ativa ? 1 : 0})` }}
            />
            <div className="flex items-center gap-2">
              <Icone
                className={cn('size-4 transition-colors duration-500', ativa ? 'text-primary' : 'text-white/25')}
                aria-hidden
              />
              <span className="font-mono text-4xs tabular-nums text-white/30">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <p
              className={cn(
                'mt-3 text-sm font-medium transition-colors duration-500',
                ativa ? 'text-white' : 'text-white/45'
              )}
            >
              {etapa.titulo}
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-white/45">{etapa.detalhe}</p>
          </li>
        )
      })}
    </ol>
  )
}
