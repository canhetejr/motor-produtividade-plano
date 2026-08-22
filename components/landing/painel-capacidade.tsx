'use client'

import { JANELA_DADOS } from '@/lib/landing/movimento'
import { cn } from '@/lib/utils'
import { Medidor, Numero, Rotulo } from './dados-tecnicos'

/**
 * Capacidade da equipe — o painel que responde "quem está sobrecarregado e quem
 * tem folga, hoje".
 *
 * Os mesmos cinco números que a cena 3D desenha como barras no ato anterior
 * (128/104/92/87/46). A repetição é o ponto: o gráfico atrás e o painel aqui
 * mostram o mesmo dado, para que a leitura seja "o abstrato virou concreto" e
 * não "apareceu outro gráfico".
 *
 * Convergência aplicada ao layout (docs/design/system.md §1): um número dominante — o
 * índice do time — e o resto subordinado. Não é uma grade de valores de mesmo
 * peso.
 */

const PESSOAS = [
  { nome: 'Luiz S.', pct: 128, situacao: 'sobrecarregado' },
  { nome: 'Mariana F.', pct: 104, situacao: 'no limite' },
  { nome: 'Camila F.', pct: 92, situacao: 'equilibrado' },
  { nome: 'Taynara R.', pct: 87, situacao: 'equilibrado' },
  { nome: 'William N.', pct: 46, situacao: 'com folga' },
] as const

export function PainelCapacidade({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-4 rounded-md border border-white/10 bg-[#0a0913] p-4 sm:grid-cols-[1.35fr_1fr]',
        className
      )}
    >
      <section>
        <Rotulo numero="01">Capacidade da equipe</Rotulo>
        <ul className="mt-4 flex flex-col gap-3">
          {PESSOAS.map((p, i) => (
            <li key={p.nome} className="grid grid-cols-[5.5rem_1fr_2.6rem] items-center gap-3">
              <span className="truncate text-2xs text-white/70">{p.nome}</span>
              <Medidor
                valor={p.pct}
                acento={p.pct > 100}
                // Atraso proporcional à posição: as barras entram em
                // alinhamento uma depois da outra, e a leitura acompanha.
                inicio={JANELA_DADOS.inicio + i * JANELA_DADOS.escalonamento}
                fim={JANELA_DADOS.fim + i * JANELA_DADOS.escalonamento}
              />
              <Numero
                ate={p.pct}
                sufixo="%"
                inicio={JANELA_DADOS.inicio + i * JANELA_DADOS.escalonamento}
                fim={JANELA_DADOS.fim + i * JANELA_DADOS.escalonamento}
                className={cn('text-right text-2xs font-semibold', p.pct > 100 ? 'text-primary' : 'text-white/55')}
              />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-3xs leading-relaxed text-white/40">
          Entregue sobre a meta de cada pessoa no período — meta individual, não régua única.
        </p>
      </section>

      <section className="flex flex-col justify-between gap-4 border-white/10 sm:border-l sm:pl-4">
        <div>
          <Rotulo numero="02">Índice do time</Rotulo>
          {/* O número dominante do bloco. É ele que a seção inteira existe
              para entregar. */}
          <p className="mt-2 font-mono text-[2.75rem] font-medium leading-none text-primary">
            <Numero ate={94} sufixo="%" inicio={JANELA_DADOS.inicio + 0.04} fim={JANELA_DADOS.fim + 0.06} />
          </p>
          <p className="mt-2 text-3xs text-white/45">
            <span className="text-primary">+6 pts</span> sobre a semana anterior
          </p>
        </div>
        <div>
          <Rotulo numero="03">Últimas 7 semanas</Rotulo>
          <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden>
            {[62, 71, 68, 84, 91, 88, 96].map((altura, i) => (
              <span
                key={i}
                className={cn(
                  'min-w-0 flex-1 rounded-sm transition-[height] duration-700 ease-[cubic-bezier(.16,1,.3,1)]',
                  i === 6 ? 'bg-primary' : 'bg-white/20'
                )}
                style={{ height: `${altura}%` }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
