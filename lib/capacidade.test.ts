import { describe, it, expect } from 'vitest'
import { situacaoDe, resumirCapacidade, type CargaColaborador } from './capacidade'

const pessoa = (nome: string, tempo: number, carga = 1000): CargaColaborador => ({
  colaborador_id: nome,
  nome,
  carga_total: carga,
  tempo_total: tempo,
})

describe('situacaoDe', () => {
  it('classifica pelas bordas dos limiares', () => {
    expect(situacaoDe(pessoa('a', 1150))).toBe('sobrecarregado') // exatamente 115%
    expect(situacaoDe(pessoa('b', 1149))).toBe('no_limite')
    expect(situacaoDe(pessoa('c', 1000))).toBe('no_limite') // exatamente 100%
    expect(situacaoDe(pessoa('d', 999))).toBe('equilibrado')
    expect(situacaoDe(pessoa('e', 600))).toBe('equilibrado') // exatamente 60%
    expect(situacaoDe(pessoa('f', 599))).toBe('ocioso')
  })

  it('trata carga zero como "sem jornada", não como sobrecarga', () => {
    // Dividir por zero daria Infinity e a pessoa apareceria no topo da lista de
    // sobrecarregados sem sequer ter jornada cadastrada.
    expect(situacaoDe(pessoa('g', 500, 0))).toBe('sem_carga')
  })

  it('trata carga negativa como "sem jornada"', () => {
    expect(situacaoDe(pessoa('h', 500, -100))).toBe('sem_carga')
  })

  it('classifica quem não entregou nada como ocioso', () => {
    expect(situacaoDe(pessoa('i', 0))).toBe('ocioso')
  })
})

describe('meta personalizada', () => {
  it('mede a entrega contra a meta, nao contra a carga cheia', () => {
    // Quem tem meta de 80% e entrega 80% esta em dia. Medir contra a carga
    // cheia classificaria essa pessoa como ociosa todo mes.
    expect(situacaoDe({ ...pessoa('a', 800), meta: 0.8 })).toBe('no_limite')
    expect(situacaoDe(pessoa('b', 800))).toBe('equilibrado')
  })

  it('meta acima de 100% torna a sobrecarga mais dificil de atingir', () => {
    // 1400 sobre carga 1000: 140% da jornada, sobrecarga. Com meta 1.5 o alvo
    // vira 1500, entao 1400 e 93% do combinado — dentro do esperado.
    expect(situacaoDe(pessoa('c', 1400))).toBe('sobrecarregado')
    expect(situacaoDe({ ...pessoa('d', 1400), meta: 1.5 })).toBe('equilibrado')
    // So passa de 115% do alvo e que volta a ser sobrecarga.
    expect(situacaoDe({ ...pessoa('e', 1800), meta: 1.5 })).toBe('sobrecarregado')
  })

  it('meta ausente ou invalida se comporta como 1', () => {
    expect(situacaoDe({ ...pessoa('e', 1000), meta: 0 })).toBe('no_limite')
    expect(situacaoDe({ ...pessoa('f', 1000), meta: undefined })).toBe('no_limite')
  })
})

describe('resumirCapacidade', () => {
  const equipe = [
    pessoa('Equilibrada', 800),
    pessoa('Sobrecarregada', 1400),
    pessoa('Muito sobrecarregada', 1800),
    pessoa('Ociosa', 300),
    pessoa('Muito ociosa', 100),
    pessoa('Sem jornada', 200, 0),
  ]

  it('ordena os grupos do mais urgente ao menos', () => {
    const resumo = resumirCapacidade(equipe)
    expect(resumo.map((r) => r.situacao)).toEqual([
      'sobrecarregado',
      'ocioso',
      'equilibrado',
      'sem_carga',
    ])
  })

  it('põe o mais sobrecarregado no topo do seu grupo', () => {
    const resumo = resumirCapacidade(equipe)
    const sobre = resumo.find((r) => r.situacao === 'sobrecarregado')!
    expect(sobre.pessoas[0].nome).toBe('Muito sobrecarregada')
  })

  it('põe o mais parado no topo do grupo de folga', () => {
    // Ordem invertida de propósito: nos dois grupos o topo é o caso extremo.
    const resumo = resumirCapacidade(equipe)
    const ocioso = resumo.find((r) => r.situacao === 'ocioso')!
    expect(ocioso.pessoas[0].nome).toBe('Muito ociosa')
  })

  it('omite grupo vazio em vez de criar seção sem conteúdo', () => {
    const resumo = resumirCapacidade([pessoa('só ela', 800)])
    expect(resumo).toHaveLength(1)
    expect(resumo[0].situacao).toBe('equilibrado')
  })

  it('não perde nem duplica pessoa', () => {
    const resumo = resumirCapacidade(equipe)
    const nomes = resumo.flatMap((r) => r.pessoas.map((p) => p.nome)).sort()
    expect(nomes).toHaveLength(equipe.length)
    expect(new Set(nomes).size).toBe(equipe.length)
  })

  it('devolve lista vazia sem ninguém', () => {
    expect(resumirCapacidade([])).toEqual([])
  })
})
