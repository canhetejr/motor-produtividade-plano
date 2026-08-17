import { describe, expect, it } from 'vitest'

import {
  areaComumDosResponsaveis,
  demandaPermitidaParaResponsaveis,
  demandasPermitidasParaResponsaveis,
  motivoSemDemanda,
} from './demandas-responsaveis'

const membros = [
  { id: 'luiz', areaId: 'moodle' },
  { id: 'ana', areaId: 'moodle' },
  { id: 'camila', areaId: 'auxiliar' },
  { id: 'sem-area', areaId: null },
]

const demandas = [
  { id: 'moodle-1', areaId: 'moodle', nome: 'Revisar disciplina' },
  { id: 'moodle-2', areaId: 'moodle', nome: 'Publicar conteúdo' },
  { id: 'auxiliar-1', areaId: 'auxiliar', nome: 'Apoio operacional' },
]

describe('demandas permitidas pelos responsáveis', () => {
  it('mostra somente demandas da área comum', () => {
    expect(areaComumDosResponsaveis(membros, ['luiz', 'ana'])).toBe('moodle')
    expect(demandasPermitidasParaResponsaveis(demandas, membros, ['luiz', 'ana']).map((d) => d.id))
      .toEqual(['moodle-1', 'moodle-2'])
  })

  it('não oferece demandas para responsáveis de áreas diferentes', () => {
    expect(areaComumDosResponsaveis(membros, ['luiz', 'camila'])).toBeNull()
    expect(demandasPermitidasParaResponsaveis(demandas, membros, ['luiz', 'camila'])).toEqual([])
  })

  it('não oferece demandas sem responsável, com área ausente ou membro desconhecido', () => {
    expect(demandasPermitidasParaResponsaveis(demandas, membros, [])).toEqual([])
    expect(demandasPermitidasParaResponsaveis(demandas, membros, ['sem-area'])).toEqual([])
    expect(demandasPermitidasParaResponsaveis(demandas, membros, ['desconhecido'])).toEqual([])
  })

  it('valida a demanda selecionada contra todos os responsáveis', () => {
    expect(demandaPermitidaParaResponsaveis('moodle-1', demandas, membros, ['luiz'])).toBe(true)
    expect(demandaPermitidaParaResponsaveis('auxiliar-1', demandas, membros, ['luiz'])).toBe(false)
    expect(demandaPermitidaParaResponsaveis('', demandas, membros, ['luiz'])).toBe(true)
  })
})

describe('motivo de o seletor de demanda estar vazio', () => {
  it('pede para selecionar um responsável quando nenhum foi escolhido', () => {
    expect(motivoSemDemanda(demandas, membros, [])).toMatch(/selecione um responsável/i)
  })

  it('aponta responsável sem área cadastrada', () => {
    expect(motivoSemDemanda(demandas, membros, ['sem-area'])).toMatch(/não tem área definida/i)
    expect(motivoSemDemanda(demandas, membros, ['luiz', 'sem-area'])).toMatch(/não tem área definida/i)
  })

  it('aponta responsáveis de áreas diferentes', () => {
    expect(motivoSemDemanda(demandas, membros, ['luiz', 'camila'])).toMatch(/áreas diferentes/i)
  })

  it('aponta área sem demanda ativa quando os responsáveis são da mesma área sem demanda cadastrada', () => {
    const membrosSemDemanda = [...membros, { id: 'bruno', areaId: 'financeiro' }]
    expect(motivoSemDemanda(demandas, membrosSemDemanda, ['bruno'])).toMatch(/não tem demanda ativa/i)
  })
})
