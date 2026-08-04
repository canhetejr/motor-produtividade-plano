import { describe, expect, it } from 'vitest'

import {
  areaComumDosResponsaveis,
  demandaPermitidaParaResponsaveis,
  demandasPermitidasParaResponsaveis,
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
