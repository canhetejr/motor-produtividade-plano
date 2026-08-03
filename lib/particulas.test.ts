import { describe, it, expect } from 'vitest'
import {
  quantidadeParaTela,
  avancar,
  arestasVisiveis,
  criarParticulas,
  DISTANCIA_ARESTA,
  MAX_PARTICULAS,
  type Particula,
} from './particulas'

const p = (x: number, y: number, vx = 0, vy = 0): Particula => ({ x, y, vx, vy })

describe('quantidadeParaTela', () => {
  it('cresce com a área', () => {
    expect(quantidadeParaTela(1920, 1080)).toBeGreaterThan(quantidadeParaTela(375, 667))
  })

  it('respeita o teto mesmo em tela enorme', () => {
    // O laço de arestas é O(n²); sem teto uma tela 4K derrubaria o quadro.
    expect(quantidadeParaTela(3840, 2160)).toBe(MAX_PARTICULAS)
  })

  it('mantém um mínimo em tela pequena', () => {
    expect(quantidadeParaTela(320, 400)).toBeGreaterThanOrEqual(12)
  })

  it('devolve zero para tela sem dimensão', () => {
    expect(quantidadeParaTela(0, 0)).toBe(0)
    expect(quantidadeParaTela(-10, 100)).toBe(0)
  })
})

describe('avancar', () => {
  it('move conforme a velocidade e o tempo', () => {
    // delta abaixo do teto de 0.05s, senao o proprio teto domina a conta:
    // 10 px/s * 0.98 de atrito * 0.04s = 0.392 px.
    const ps = [p(100, 100, 10, 0)]
    avancar(ps, 500, 500, 0.04, null)
    expect(ps[0].x).toBeCloseTo(100.392, 2)
  })

  it('escala pelo tempo, não pelo quadro', () => {
    // Num monitor de 120 Hz um passo fixo dobraria a velocidade percebida.
    const lento = [p(100, 100, 100, 0)]
    const rapido = [p(100, 100, 100, 0)]
    avancar(lento, 500, 500, 0.02, null)
    avancar(rapido, 500, 500, 0.01, null)
    avancar(rapido, 500, 500, 0.01, null)
    expect(lento[0].x).toBeCloseTo(rapido[0].x, 1)
  })

  it('limita o salto quando a aba volta do segundo plano', () => {
    // Sem o teto de delta, 30 segundos parados teleportariam tudo.
    const ps = [p(100, 100, 100, 0)]
    avancar(ps, 500, 500, 30, null)
    expect(ps[0].x).toBeLessThan(110)
  })

  it('atravessa a borda em vez de quicar', () => {
    // Quicar acumula partícula nas beiradas, que é onde a malha fica feia.
    const ps = [p(499, 250, 100, 0)]
    avancar(ps, 500, 500, 0.05, null)
    expect(ps[0].x).toBeLessThan(50)
  })

  it('afasta do ponteiro, não atrai', () => {
    // Atrair faria tudo se acumular sob o cursor e sumir como malha.
    const ps = [p(200, 200)]
    avancar(ps, 500, 500, 0.1, { x: 190, y: 200 })
    expect(ps[0].x).toBeGreaterThan(200)
  })

  it('ignora ponteiro distante', () => {
    const ps = [p(200, 200)]
    avancar(ps, 500, 500, 0.1, { x: 480, y: 480 })
    expect(ps[0].vx).toBe(0)
    expect(ps[0].vy).toBe(0)
  })

  it('freia por atrito em vez de acelerar sem fim', () => {
    // Sem atrito, o empurrão do ponteiro se acumula e tudo sai em disparada.
    const ps = [p(200, 200, 100, 0)]
    for (let i = 0; i < 200; i++) avancar(ps, 5000, 5000, 0.016, null)
    expect(Math.abs(ps[0].vx)).toBeLessThan(10)
  })

  it('não gera NaN com ponteiro exatamente em cima', () => {
    // Distância zero dividiria por zero e a partícula sumiria para sempre.
    const ps = [p(200, 200)]
    avancar(ps, 500, 500, 0.1, { x: 200, y: 200 })
    expect(Number.isFinite(ps[0].x)).toBe(true)
    expect(Number.isFinite(ps[0].y)).toBe(true)
  })
})

describe('arestasVisiveis', () => {
  it('liga o que está perto', () => {
    expect(arestasVisiveis([p(0, 0), p(50, 0)])).toHaveLength(1)
  })

  it('não liga o que está longe', () => {
    expect(arestasVisiveis([p(0, 0), p(DISTANCIA_ARESTA + 1, 0)])).toHaveLength(0)
  })

  it('a intensidade cai com a distância', () => {
    const perto = arestasVisiveis([p(0, 0), p(10, 0)])[0]
    const longe = arestasVisiveis([p(0, 0), p(120, 0)])[0]
    expect(perto.forca).toBeGreaterThan(longe.forca)
  })

  it('não repete o par nem liga a partícula a si mesma', () => {
    expect(arestasVisiveis([p(0, 0), p(10, 0), p(20, 0)])).toHaveLength(3)
  })

  it('devolve vazio com menos de duas partículas', () => {
    expect(arestasVisiveis([p(0, 0)])).toEqual([])
    expect(arestasVisiveis([])).toEqual([])
  })
})

describe('criarParticulas', () => {
  it('respeita a quantidade calculada para a tela', () => {
    expect(criarParticulas(1000, 1000, () => 0.5)).toHaveLength(quantidadeParaTela(1000, 1000))
  })

  it('nasce dentro da tela', () => {
    for (const part of criarParticulas(800, 600)) {
      expect(part.x).toBeGreaterThanOrEqual(0)
      expect(part.x).toBeLessThanOrEqual(800)
      expect(part.y).toBeGreaterThanOrEqual(0)
      expect(part.y).toBeLessThanOrEqual(600)
    }
  })

  it('nasce devagar — o fundo é percebido, não acompanhado', () => {
    for (const part of criarParticulas(800, 600)) {
      expect(Math.abs(part.vx)).toBeLessThanOrEqual(7)
      expect(Math.abs(part.vy)).toBeLessThanOrEqual(7)
    }
  })
})
