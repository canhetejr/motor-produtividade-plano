'use client'

import { createContext, useContext } from 'react'
import { type MotionValue, useMotionValue } from 'framer-motion'

import { alturaDoAto, type IndiceAto } from '@/lib/landing/atos'
import { useCapitulo } from './contexto'
import { cn } from '@/lib/utils'

type Capitulo = { bruto: MotionValue<number>; visivel: MotionValue<number> }

/** Elipses largas e sem borda dura: o escurecimento tem que ser sentido como
 *  profundidade, nunca visto como uma mancha desenhada por cima da cena. */
const SCRIMS: Record<'centro' | 'esquerda' | 'coluna', string> = {
  centro: 'radial-gradient(ellipse 66% 50% at 50% 50%, rgba(5,5,11,.94), rgba(5,5,11,.72) 52%, transparent 84%)',
  esquerda: 'radial-gradient(ellipse 60% 62% at 26% 50%, rgba(5,5,11,.95), rgba(5,5,11,.76) 50%, transparent 82%)',
  coluna: 'radial-gradient(ellipse 44% 78% at 50% 50%, rgba(5,5,11,.96), rgba(5,5,11,.82) 48%, transparent 86%)',
}

const CapituloContexto = createContext<Capitulo | null>(null)

/** Progresso do capítulo em volta. Fora de um `<Ato>` devolve zero parado, para
 *  que um componente de revelação nunca quebre se for reaproveitado solto. */
export function useCapituloAtual(): Capitulo {
  const ctx = useContext(CapituloContexto)
  const vazio = useMotionValue(0)
  return ctx ?? { bruto: vazio, visivel: vazio }
}

/**
 * Um capítulo da narrativa.
 *
 * `ordem` é a posição da seção na página; `atos` são as formações da cena 3D
 * que ela cobre. Quase sempre é um ato por seção, mas o quadro Kanban cobre
 * dois (montagem e operação) numa seção só — assim o painel do produto fica
 * grudado durante a cena inteira em vez de sair de tela e voltar na fronteira
 * entre os dois atos, que é o tipo de corte que denuncia a costura.
 *
 * A altura vem da faixa que os atos ocupam na timeline: tempo de rolagem
 * proporcional à densidade da cena, em vez de espremer a convergência e
 * alongar a respiração.
 *
 * O conteúdo gruda por uma tela e não usa pinning com sequestro de rolagem.
 * Pinning daria controle mais fino sobre cada quadro, e daria também a sensação
 * de que a página parou de responder — o defeito mais comum deste tipo de
 * experiência. Aqui a rolagem nunca é interceptada: o texto sobe, a cena atrás
 * dele se transforma.
 */
export function Ato({
  ordem,
  atos,
  children,
  className,
  rotulo,
  id,
  scrim = 'centro',
}: {
  ordem: number
  atos: readonly IndiceAto[]
  children: React.ReactNode
  className?: string
  /** Nome da seção para leitores de tela. */
  rotulo: string
  id?: string
  /** Onde escurecer a cena para o texto ficar legível por cima dela.
   *  `coluna` é estreito e alto: serve aos capítulos em que a estrutura do
   *  vértice cruza a tela inteira na vertical e as duas arestas passam
   *  exatamente por cima de uma coluna de texto centralizada. */
  scrim?: 'centro' | 'esquerda' | 'coluna' | 'nenhum'
}) {
  const { ref, bruto, visivel } = useCapitulo(ordem, atos.length)
  const altura = atos.reduce<number>((soma, a) => soma + alturaDoAto(a), 0)

  return (
    <section
      ref={ref}
      id={id}
      aria-label={rotulo}
      className={cn('relative', className)}
      style={{ minHeight: `${altura * 100}vh` }}
    >
      <CapituloContexto.Provider value={{ bruto, visivel }}>
        {/* A perspectiva vive aqui, no ancestral: `Profundidade` recua os
            blocos em Z, e sem um ancestral com perspective o translateZ não
            produz encurtamento nenhum — o recuo viraria só um fade. */}
        <div className="sticky top-0 flex min-h-dvh items-center overflow-hidden [perspective:1400px]">
          {/* Contraste é requisito de acessibilidade, não gosto: texto branco
              sobre um campo aditivo perde legibilidade exatamente onde o campo
              está mais denso. Em vez de apagar a cena inteira (o que custaria o
              efeito) ou empurrar o texto para longe dela (o que custaria a
              composição), escurece-se só a área que fica sob o texto, com uma
              elipse larga o bastante para nunca ter borda visível. */}
          {scrim !== 'nenhum' && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-[1]"
              style={{
                background: SCRIMS[scrim],
              }}
            />
          )}
          <div className="relative mx-auto w-full max-w-6xl px-6 py-24">{children}</div>
        </div>
      </CapituloContexto.Provider>
    </section>
  )
}
