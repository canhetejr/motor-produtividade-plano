import { describe, it, expect } from 'vitest'
import {
  produtividadeDe,
  produtividadeDaExecucao,
  faixaDe,
  formatarProdutividade,
  sugerirTempoFixo,
  ehNivelComplexidade,
  EXECUCOES_PARA_SUGERIR,
  type Medicao,
} from './produtividade'

const exec = (esperado: number, real: number): Medicao => ({
  esperado_min: esperado,
  real_min: real,
})

describe('produtividadeDe', () => {
  it('mede esperado sobre real', () => {
    expect(produtividadeDaExecucao(exec(60, 30))).toBe(2) // metade do tempo
    expect(produtividadeDaExecucao(exec(60, 60))).toBe(1)
    expect(produtividadeDaExecucao(exec(60, 120))).toBe(0.5)
  })

  it('agrega ponderado pelo tempo, não pela média das razões', () => {
    // Uma execução curtíssima muito rápida (razão 30) e uma longa no ritmo.
    // Média de razões daria (30 + 1) / 2 = 15,5 — a demanda pareceria 1550%
    // produtiva por causa de dois minutos de trabalho.
    const medicoes = [exec(60, 2), exec(600, 600)]
    expect(produtividadeDe(medicoes)).toBeCloseTo(660 / 602, 6)
    expect(produtividadeDe(medicoes)!).toBeLessThan(1.2)
  })

  it('devolve null quando não há o que medir, e não zero', () => {
    // Zero é um resultado ruim; ausência de medição não é resultado nenhum.
    // Pintar as duas coisas da mesma cor mentiria para o gestor.
    expect(produtividadeDe([])).toBeNull()
    expect(produtividadeDaExecucao(exec(60, 0))).toBeNull()
    expect(produtividadeDaExecucao(exec(0, 60))).toBeNull()
    expect(produtividadeDaExecucao(exec(60, -5))).toBeNull()
  })

  it('ignora execuções inválidas sem descartar as boas', () => {
    expect(produtividadeDe([exec(60, 0), exec(60, 60)])).toBe(1)
  })
})

describe('faixaDe', () => {
  it('classifica pelas bordas dos limiares', () => {
    expect(faixaDe(1.15)).toBe('acima') // exatamente 115%
    expect(faixaDe(1.149)).toBe('no_ritmo')
    expect(faixaDe(0.95)).toBe('no_ritmo') // exatamente 95%
    expect(faixaDe(0.949)).toBe('atencao')
    expect(faixaDe(0.75)).toBe('atencao') // exatamente 75%
    expect(faixaDe(0.749)).toBe('abaixo')
  })

  it('separa ausência de medição de produtividade ruim', () => {
    expect(faixaDe(null)).toBe('sem_medicao')
    expect(faixaDe(0)).toBe('sem_medicao')
    expect(faixaDe(Infinity)).toBe('sem_medicao')
    expect(faixaDe(NaN)).toBe('sem_medicao')
    expect(faixaDe(0.01)).toBe('abaixo')
  })
})

describe('formatarProdutividade', () => {
  it('arredonda para inteiro e marca ausência com travessão', () => {
    expect(formatarProdutividade(1.126)).toBe('113%')
    expect(formatarProdutividade(1)).toBe('100%')
    expect(formatarProdutividade(null)).toBe('—')
  })
})

describe('sugerirTempoFixo', () => {
  const resumo = (execucoes: number, media = 47, min = 40, max = 55) => ({
    execucoes,
    media_real_min: media,
    min_real_min: min,
    max_real_min: max,
  })

  it('não sugere antes do mínimo de execuções', () => {
    expect(sugerirTempoFixo(resumo(EXECUCOES_PARA_SUGERIR - 1))).toBeNull()
  })

  it('sugere a média arredondada a partir do mínimo', () => {
    const s = sugerirTempoFixo(resumo(EXECUCOES_PARA_SUGERIR, 46.6))
    expect(s?.minutos).toBe(47)
    expect(s?.execucoes).toBe(EXECUCOES_PARA_SUGERIR)
  })

  it('expõe a dispersão para o gestor poder recusar', () => {
    // Demanda que leva de 10 a 90 min tem média 50 e amplitude 80: fixar
    // tempo padrão aqui trocaria "não sei medir" por "meço errado".
    const s = sugerirTempoFixo(resumo(20, 50, 10, 90))
    expect(s?.dispersao).toBeCloseTo(1.6, 6)

    const estavel = sugerirTempoFixo(resumo(20, 50, 45, 55))
    expect(estavel?.dispersao).toBeCloseTo(0.2, 6)
  })

  it('nunca sugere zero minutos', () => {
    expect(sugerirTempoFixo(resumo(20, 0.2, 0, 1))?.minutos).toBe(1)
  })
})

describe('ehNivelComplexidade', () => {
  it('aceita só os quatro níveis', () => {
    expect(ehNivelComplexidade('alta')).toBe(true)
    expect(ehNivelComplexidade('muito_alta')).toBe(true)
    expect(ehNivelComplexidade('altissima')).toBe(false)
    expect(ehNivelComplexidade(null)).toBe(false)
    expect(ehNivelComplexidade(3)).toBe(false)
  })
})
