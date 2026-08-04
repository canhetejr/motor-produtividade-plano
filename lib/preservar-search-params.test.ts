import { describe, expect, it } from 'vitest'

import { comSearchParams } from './preservar-search-params'

describe('comSearchParams', () => {
  it('mantem filtros simples ao redirecionar uma rota legada', () => {
    expect(comSearchParams('/gestao', { periodo: '30d', area: 'operacao' })).toBe(
      '/gestao?periodo=30d&area=operacao'
    )
  })

  it('preserva parametros repetidos e ignora valores ausentes', () => {
    expect(comSearchParams('/gestao/catalogo', { tab: 'demandas', status: ['ativo', 'pendente'], busca: undefined })).toBe(
      '/gestao/catalogo?tab=demandas&status=ativo&status=pendente'
    )
  })
})
