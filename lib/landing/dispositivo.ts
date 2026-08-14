/**
 * Classificação de capacidade do aparelho.
 *
 * A landing não tem uma versão "com animação" e outra "sem": tem três níveis do
 * mesmo filme. O que muda entre eles é densidade de geometria, resolução de
 * pintura e quanto trabalho por quadro — nunca a narrativa. Um celular vê as
 * mesmas dez cenas que um desktop, com menos fragmentos.
 */

export type Nivel = 'alto' | 'medio' | 'baixo'

export type Capacidade = {
  nivel: Nivel
  /** Quantos fragmentos a cena instancia. */
  fragmentos: number
  /** Teto de devicePixelRatio na pintura. */
  dpr: number
  /** Se o campo reage ao ponteiro (desktop com mouse de verdade). */
  ponteiro: boolean
  /** Se as linhas de conexão são desenhadas. */
  linhas: boolean
  /** Se o halo em volta de cada fragmento é pintado (custa fill rate). */
  halo: boolean
  /** Usuário pediu menos movimento — a cena existe, mas quase parada. */
  reduzido: boolean
  /** WebGL2 disponível. Sem isto, cai para a composição estática. */
  webgl: boolean
}

const PERFIS: Record<Nivel, Omit<Capacidade, 'nivel' | 'reduzido' | 'webgl' | 'ponteiro'>> = {
  // O `dpr` é o parâmetro mais caro que existe aqui: ele é quadrático. Pintar
  // a 2× numa tela retina é quatro vezes o número de pixels de 1×, e a cena é
  // um campo aditivo com muita sobreposição — cada pixel é lido e escrito
  // várias vezes por quadro. Como o resultado é suave e luminoso por natureza,
  // e não tipografia ou linha fina de 1px, a diferença entre 1,5× e 2× quase
  // não se vê; o custo, sim.
  alto: { fragmentos: 760, dpr: 1.5, linhas: true, halo: true },
  medio: { fragmentos: 440, dpr: 1.25, linhas: true, halo: true },
  baixo: { fragmentos: 260, dpr: 1, linhas: false, halo: false },
}

/** Fallback de servidor/pré-hidratação: nada roda até `detectar()` no cliente. */
export const CAPACIDADE_INICIAL: Capacidade = {
  nivel: 'baixo',
  ...PERFIS.baixo,
  ponteiro: false,
  reduzido: true,
  webgl: false,
}

function temWebgl2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

/**
 * Heurística, não benchmark: rodar um teste de carga antes de começar custaria
 * exatamente o tempo que a página tem para aparecer. O nível é um palpite
 * inicial — `PerformanceManager` na cena mede o quadro real e rebaixa a
 * qualidade se o palpite tiver sido otimista.
 */
export function detectar(): Capacidade {
  if (typeof window === 'undefined') return CAPACIDADE_INICIAL

  const webgl = temWebgl2()
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // `hover: hover` separa mouse de dedo melhor que largura de tela: um tablet
  // largo não tem ponteiro, e um laptop estreito tem.
  const temMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const nucleos = navigator.hardwareConcurrency ?? 4
  // `deviceMemory` só existe em Chromium; onde não existe, o valor neutro não
  // rebaixa nem promove ninguém.
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const largura = window.innerWidth
  const dprReal = window.devicePixelRatio || 1

  let nivel: Nivel
  if (!webgl || nucleos <= 4 || memoria <= 4) {
    nivel = 'baixo'
  } else if (!temMouse || largura < 1024 || nucleos <= 8) {
    nivel = 'medio'
  } else {
    nivel = 'alto'
  }

  // Tela muito grande com DPR alto é a combinação que mais derruba quadro:
  // a área de pintura cresce com o quadrado da resolução.
  if (nivel === 'alto' && largura * dprReal > 4200) nivel = 'medio'

  return {
    nivel,
    ...PERFIS[nivel],
    dpr: Math.min(PERFIS[nivel].dpr, dprReal),
    ponteiro: temMouse && !reduzido,
    reduzido,
    webgl,
  }
}

/**
 * Rebaixa um nível. A cena chama isto quando o quadro medido não sustenta o
 * perfil atual — melhor perder densidade que perder fluidez, porque a landing
 * só é premium se for fluida.
 */
export function rebaixar(atual: Capacidade): Capacidade | null {
  const proximo: Record<Nivel, Nivel | null> = { alto: 'medio', medio: 'baixo', baixo: null }
  const nivel = proximo[atual.nivel]
  if (!nivel) return null
  return { ...atual, nivel, ...PERFIS[nivel], dpr: Math.min(PERFIS[nivel].dpr, atual.dpr) }
}
