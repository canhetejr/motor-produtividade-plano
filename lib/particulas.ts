/**
 * Simulação da malha de vértices reativa.
 *
 * Separada do componente porque o custo desta funcionalidade é inteiro dela: um
 * laço que roda 60 vezes por segundo em toda tela do app. As decisões que
 * impedem isso de virar peso morto — quantas partículas, a que distância ligar,
 * quando não desenhar — ficam aqui, testáveis, em vez de escondidas num
 * `requestAnimationFrame`.
 */

export type Particula = {
  x: number
  y: number
  /** Velocidade em px por segundo. */
  vx: number
  vy: number
}

export type Ponteiro = { x: number; y: number } | null

/** Distância máxima para ligar duas partículas com uma aresta. */
export const DISTANCIA_ARESTA = 130
/** Raio de influência do ponteiro. */
export const RAIO_PONTEIRO = 150
/** Teto absoluto: acima disso o custo do laço de arestas cresce rápido demais. */
export const MAX_PARTICULAS = 90

/**
 * Quantidade proporcional à área, com teto.
 *
 * O laço de arestas é O(n²) — 90 partículas dão 4.005 pares por quadro, que uma
 * máquina modesta aguenta. Dobrar para 180 daria 16.110, quatro vezes mais, e é
 * onde um notebook antigo começa a engasgar.
 */
export function quantidadeParaTela(largura: number, altura: number): number {
  if (largura <= 0 || altura <= 0) return 0
  const porArea = Math.round((largura * altura) / 18000)
  return Math.max(12, Math.min(MAX_PARTICULAS, porArea))
}

/**
 * Avança a simulação.
 *
 * `delta` em segundos, e não "um passo por quadro": num monitor de 120 Hz o
 * movimento sairia com o dobro da velocidade se o passo fosse fixo.
 *
 * O limite de delta existe para a aba que volta do segundo plano — sem ele, um
 * `delta` de 30 segundos teleportaria tudo para fora da tela de uma vez.
 */
export function avancar(
  particulas: Particula[],
  largura: number,
  altura: number,
  delta: number,
  ponteiro: Ponteiro,
  reatividade: number = 1
): void {
  const dt = Math.min(delta, 0.05)

  for (const p of particulas) {
    // Reação ao ponteiro: empurra de leve para longe. Atrair faria as
    // partículas se acumularem sob o cursor e sumirem como malha.
    if (ponteiro) {
      const dx = p.x - ponteiro.x
      const dy = p.y - ponteiro.y
      const dist = Math.hypot(dx, dy)
      if (dist > 0 && dist < RAIO_PONTEIRO) {
        const forca = ((RAIO_PONTEIRO - dist) / RAIO_PONTEIRO) * 40 * reatividade
        p.vx += (dx / dist) * forca * dt
        p.vy += (dy / dist) * forca * dt
      }
    }

    // Atrito: sem ele o empurrão do ponteiro se acumula e as partículas saem em
    // disparada depois de alguns segundos de movimento do mouse.
    p.vx *= 0.98
    p.vy *= 0.98

    p.x += p.vx * dt
    p.y += p.vy * dt

    // Atravessa a borda e reaparece do outro lado. Quicar criaria acúmulo nas
    // beiradas, que é justamente onde a malha fica feia.
    if (p.x < 0) p.x += largura
    else if (p.x > largura) p.x -= largura
    if (p.y < 0) p.y += altura
    else if (p.y > altura) p.y -= altura
  }
}

export type Aresta = { a: Particula; b: Particula; forca: number }

/**
 * Pares próximos o bastante para ligar, com a intensidade da linha.
 *
 * Compara o quadrado da distância: `Math.hypot` por par, 4.005 vezes por
 * quadro, aparece no perfil de desempenho. A raiz só é tirada nos pares que
 * realmente viram aresta.
 */
export function arestasVisiveis(particulas: Particula[], alcance: number = DISTANCIA_ARESTA): Aresta[] {
  const arestas: Aresta[] = []
  const limite = alcance * alcance

  for (let i = 0; i < particulas.length; i++) {
    for (let j = i + 1; j < particulas.length; j++) {
      const dx = particulas[i].x - particulas[j].x
      const dy = particulas[i].y - particulas[j].y
      const quadrado = dx * dx + dy * dy
      if (quadrado >= limite) continue
      const dist = Math.sqrt(quadrado)
      arestas.push({
        a: particulas[i],
        b: particulas[j],
        forca: 1 - dist / alcance,
      })
    }
  }
  return arestas
}

/** Cria a malha inicial com posição e direção aleatórias.
 *
 * `densidade` multiplica a quantidade já calculada para a tela — o teto de
 * `MAX_PARTICULAS` continua valendo antes da multiplicação, então mesmo no
 * limite superior de densidade (2×) o total fica em 180, o próprio patamar
 * que o comentário de `quantidadeParaTela` aponta como onde o custo O(n²)
 * das arestas começa a pesar. Não escala além disso de propósito. */
export function criarParticulas(
  largura: number,
  altura: number,
  aleatorio: () => number = Math.random,
  densidade: number = 1,
  velocidade: number = 1
): Particula[] {
  const total = Math.round(quantidadeParaTela(largura, altura) * densidade)
  return Array.from({ length: total }, () => ({
    x: aleatorio() * largura,
    y: aleatorio() * altura,
    // Devagar de propósito: o fundo tem que ser percebido, não acompanhado.
    vx: (aleatorio() - 0.5) * 14 * velocidade,
    vy: (aleatorio() - 0.5) * 14 * velocidade,
  }))
}
