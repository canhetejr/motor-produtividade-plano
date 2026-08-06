/** Preferência estética local: parâmetros avançados do fundo de partículas —
 * tamanho, quantidade, alcance das conexões, velocidade, reatividade ao
 * cursor, intensidade e forma dos nós. Um objeto único (e não uma chave por
 * campo) porque os campos sempre mudam juntos, pelo mesmo painel. */
export const CHAVE_PARTICULAS = 'vertice:particulas'

export type FormaParticula = 'circulo' | 'quadrado' | 'triangulo' | 'estrela'

export type PreferenciaParticulas = {
  tamanho: number
  densidade: number
  alcance: number
  velocidade: number
  reatividade: number
  opacidade: number
  forma: FormaParticula
}

export const PARTICULAS_PADRAO: PreferenciaParticulas = {
  tamanho: 1.5,
  densidade: 1,
  alcance: 130, // === DISTANCIA_ARESTA em lib/particulas.ts
  velocidade: 1,
  reatividade: 1,
  opacidade: 1,
  forma: 'circulo',
}

const FORMAS: readonly FormaParticula[] = ['circulo', 'quadrado', 'triangulo', 'estrela']

/** [mín, máx] de cada campo numérico — o teto existe porque o laço de
 * arestas é O(n²) e o de desenho roda 60x/s; sem limite um valor extremo
 * trava a aba (ver comentário em `criarParticulas`, lib/particulas.ts). */
export const LIMITES_PARTICULAS: Record<keyof Omit<PreferenciaParticulas, 'forma'>, readonly [number, number]> = {
  tamanho: [0.5, 4],
  densidade: [0.4, 2],
  alcance: [60, 220],
  velocidade: [0.2, 2.5],
  reatividade: [0, 2.5],
  opacidade: [0.3, 2],
}

function lerNumero(valor: unknown, [min, max]: readonly [number, number], padrao: number): number {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}

export function lerPreferenciaParticulas(bruto: string | null): PreferenciaParticulas {
  if (!bruto) return PARTICULAS_PADRAO
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(bruto)
  } catch {
    return PARTICULAS_PADRAO
  }
  return {
    tamanho: lerNumero(parsed.tamanho, LIMITES_PARTICULAS.tamanho, PARTICULAS_PADRAO.tamanho),
    densidade: lerNumero(parsed.densidade, LIMITES_PARTICULAS.densidade, PARTICULAS_PADRAO.densidade),
    alcance: lerNumero(parsed.alcance, LIMITES_PARTICULAS.alcance, PARTICULAS_PADRAO.alcance),
    velocidade: lerNumero(parsed.velocidade, LIMITES_PARTICULAS.velocidade, PARTICULAS_PADRAO.velocidade),
    reatividade: lerNumero(parsed.reatividade, LIMITES_PARTICULAS.reatividade, PARTICULAS_PADRAO.reatividade),
    opacidade: lerNumero(parsed.opacidade, LIMITES_PARTICULAS.opacidade, PARTICULAS_PADRAO.opacidade),
    forma: FORMAS.includes(parsed.forma as FormaParticula) ? (parsed.forma as FormaParticula) : PARTICULAS_PADRAO.forma,
  }
}
