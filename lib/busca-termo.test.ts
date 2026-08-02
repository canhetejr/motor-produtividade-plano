import { describe, it, expect } from 'vitest'
import { escaparTermoBusca } from './busca-termo'

describe('escaparTermoBusca', () => {
  it('deixa termo comum intacto', () => {
    expect(escaparTermoBusca('revisar roteiro')).toBe('revisar roteiro')
  })

  it('escapa os curingas do like', () => {
    // Sem escape, '%' casa com tudo e '_' com qualquer caractere.
    expect(escaparTermoBusca('100%')).toBe('100\\%')
    expect(escaparTermoBusca('a_b')).toBe('a\\_b')
  })

  it('escapa a vírgula, que separa condições no or() do PostgREST', () => {
    // 'a,b' viraria duas condições e quebraria a expressão inteira.
    expect(escaparTermoBusca('a,b')).toBe('a\\,b')
  })

  it('escapa parênteses, que delimitam o or()', () => {
    expect(escaparTermoBusca('(x)')).toBe('\\(x\\)')
  })

  it('escapa a própria barra invertida', () => {
    expect(escaparTermoBusca('a\\b')).toBe('a\\\\b')
  })

  it('escapa todas as ocorrências, não só a primeira', () => {
    expect(escaparTermoBusca('%%')).toBe('\\%\\%')
  })

  it('preserva acento e espaço, que não têm significado especial', () => {
    expect(escaparTermoBusca('produção final')).toBe('produção final')
  })
})
