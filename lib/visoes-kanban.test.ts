import { describe, it, expect } from 'vitest'
import {
  lerVisoes,
  salvarVisao,
  removerVisao,
  mesmosFiltros,
  filtrosVazios,
  chaveDeArmazenamento,
  FILTROS_VAZIOS,
  type VisaoSalva,
} from './visoes-kanban'

const visao: VisaoSalva = {
  id: 'v1',
  nome: 'Meus atrasados',
  busca: 'roteiro',
  prioridade: 'alta',
  responsavel: 'abc',
}

describe('lerVisoes', () => {
  it('devolve lista vazia quando não há nada salvo', () => {
    expect(lerVisoes(null)).toEqual([])
    expect(lerVisoes('')).toEqual([])
  })

  it('não quebra com JSON inválido', () => {
    // Pode ter sido editado à mão no DevTools ou corrompido.
    expect(lerVisoes('{isso não é json')).toEqual([])
  })

  it('ignora conteúdo que não é lista', () => {
    expect(lerVisoes('{"nome":"x"}')).toEqual([])
    expect(lerVisoes('42')).toEqual([])
  })

  it('descarta item com formato de uma versão anterior', () => {
    // Sem `responsavel`: gravado antes do filtro existir.
    const bruto = JSON.stringify([{ id: 'a', nome: 'antiga', busca: '', prioridade: 'todas' }])
    expect(lerVisoes(bruto)).toEqual([])
  })

  it('descarta visão sem nome, que ficaria inclicável na lista', () => {
    const bruto = JSON.stringify([{ ...visao, nome: '   ' }])
    expect(lerVisoes(bruto)).toEqual([])
  })

  it('mantém os itens válidos e descarta só os quebrados', () => {
    const bruto = JSON.stringify([visao, { id: 'x' }, { ...visao, id: 'v2', nome: 'Outra' }])
    expect(lerVisoes(bruto).map((v) => v.id)).toEqual(['v1', 'v2'])
  })
})

describe('salvarVisao', () => {
  it('acrescenta quando o nome é novo', () => {
    expect(salvarVisao([visao], { ...visao, id: 'v2', nome: 'Outra' })).toHaveLength(2)
  })

  it('substitui a de mesmo nome em vez de duplicar', () => {
    const nova = { ...visao, id: 'v9', busca: 'outro' }
    const lista = salvarVisao([visao], nova)
    expect(lista).toHaveLength(1)
    expect(lista[0].id).toBe('v9')
  })

  it('compara nome sem diferenciar maiúscula nem espaço nas pontas', () => {
    const nova = { ...visao, id: 'v9', nome: '  MEUS ATRASADOS ' }
    expect(salvarVisao([visao], nova)).toHaveLength(1)
  })
})

describe('removerVisao', () => {
  it('remove pelo id', () => {
    expect(removerVisao([visao], 'v1')).toEqual([])
  })

  it('não altera a lista com id inexistente', () => {
    expect(removerVisao([visao], 'nao-existe')).toEqual([visao])
  })
})

describe('mesmosFiltros', () => {
  it('ignora espaço nas pontas da busca', () => {
    expect(mesmosFiltros({ ...FILTROS_VAZIOS, busca: ' x ' }, { ...FILTROS_VAZIOS, busca: 'x' })).toBe(true)
  })

  it('distingue quando um filtro difere', () => {
    expect(mesmosFiltros(FILTROS_VAZIOS, { ...FILTROS_VAZIOS, prioridade: 'alta' })).toBe(false)
  })
})

describe('filtrosVazios', () => {
  it('reconhece o estado inicial', () => {
    expect(filtrosVazios(FILTROS_VAZIOS)).toBe(true)
    expect(filtrosVazios({ ...FILTROS_VAZIOS, busca: '  ' })).toBe(true)
  })

  it('reconhece qualquer filtro ativo', () => {
    expect(filtrosVazios({ ...FILTROS_VAZIOS, responsavel: 'abc' })).toBe(false)
  })
})

describe('chaveDeArmazenamento', () => {
  it('separa por quadro, para uma visão não vazar para outro', () => {
    expect(chaveDeArmazenamento('q1')).not.toBe(chaveDeArmazenamento('q2'))
  })
})
