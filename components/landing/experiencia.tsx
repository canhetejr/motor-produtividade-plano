'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { CAPACIDADE_INICIAL, type Capacidade } from '@/lib/landing/dispositivo'
import type { CenaConvergencia, Instrumentacao } from '@/lib/landing/cena/cena'
import { ProvedorExperiencia } from './contexto'
import { CenaPersistente } from './cena-persistente'

/**
 * Casca da experiência: monta a cena persistente, publica a capacidade do
 * aparelho para os capítulos e coloca o conteúdo por cima.
 *
 * `children` chega pronto do Server Component da página. Isso é o que preserva
 * SSR, indexação e semântica: o HTML completo é servido e renderizado antes de
 * qualquer JavaScript de cena existir. O canvas é enriquecimento, nunca o meio
 * de entrega do conteúdo.
 */
export function Experiencia({ children }: { children: React.ReactNode }) {
  const [capacidade, setCapacidade] = useState<Capacidade>(CAPACIDADE_INICIAL)
  const cenaRef = useRef<CenaConvergencia | null>(null)
  const guardarCena = useCallback((c: CenaConvergencia | null) => {
    cenaRef.current = c
  }, [])

  return (
    <ProvedorExperiencia value={{ capacidade }}>
      <CenaPersistente aoMudarCapacidade={setCapacidade} aoPronta={guardarCena} />
      {/* z-10 e fundo transparente: o conteúdo vive acima do canvas, mas o
          canvas continua visível entre os blocos de texto. */}
      <div className="relative z-10">{children}</div>
      <Depurador cenaRef={cenaRef} />
    </ProvedorExperiencia>
  )
}

/**
 * Painel de instrumentação.
 *
 * Duas travas para nunca chegar ao usuário: some do build de produção por
 * `NODE_ENV` (o empacotador elimina o ramo inteiro) e, mesmo em
 * desenvolvimento, só aparece com `?cena=debug` na URL. Uma trava só seria
 * suficiente; duas custam nada e removem a chance de esquecer.
 */
function Depurador({ cenaRef }: { cenaRef: React.RefObject<CenaConvergencia | null> }) {
  const [dados, setDados] = useState<Instrumentacao | null>(null)
  const ligado = process.env.NODE_ENV !== 'production'

  useEffect(() => {
    if (!ligado) return
    if (!new URLSearchParams(window.location.search).has('cena')) return
    // Meia em meia segundo: o painel mede o quadro, não pode custar quadro.
    const id = window.setInterval(() => setDados(cenaRef.current?.instrumentacao() ?? null), 500)
    return () => window.clearInterval(id)
  }, [ligado, cenaRef])

  if (!ligado || !dados) return null

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[100] rounded-md border border-white/15 bg-black/85 px-3 py-2 font-mono text-4xs leading-relaxed text-white/80">
      <div>fps {dados.fps}</div>
      <div>nível {dados.nivel}</div>
      <div>dpr {dados.dpr}</div>
      <div>frag {dados.fragmentos}</div>
      <div>ato {dados.ato}</div>
      <div>t {(dados.progresso * 100).toFixed(1)}%</div>
    </div>
  )
}
