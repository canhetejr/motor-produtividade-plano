import { describe, it, expect } from 'vitest'
import {
  montarCsvDemandas,
  montarLinhasCsvDemandas,
  CABECALHO_DEMANDAS,
  type DemandaExportavel,
} from './csv-demandas'

const base: DemandaExportavel = {
  nome: 'Atendimento',
  areaNome: 'Suporte',
  tempo_padrao_min: 30,
  variavel: false,
  blocos_totais: 1,
  finita: false,
  complexidade: null,
  ativo: true,
}

describe('montarLinhasCsvDemandas', () => {
  it('monta uma linha com o número de colunas do cabeçalho', () => {
    const [linha] = montarLinhasCsvDemandas([base])
    expect(linha).toHaveLength(CABECALHO_DEMANDAS.length)
    expect(linha).toEqual(['Atendimento', 'Suporte', '30', 'Não', '1', 'Não', '', 'Sim'])
  })

  it('escreve o rótulo da complexidade, não o código do banco', () => {
    const [linha] = montarLinhasCsvDemandas([
      { ...base, variavel: true, tempo_padrao_min: null, complexidade: 'muito_alta' },
    ])
    expect(linha[6]).toBe('Muito alta')
  })

  it('deixa tempo padrão vazio quando não há valor, em vez de escrever "null"', () => {
    const [linha] = montarLinhasCsvDemandas([{ ...base, tempo_padrao_min: null }])
    expect(linha[2]).toBe('')
  })

  // Vazio, e não travessão: o arquivo volta pelo import, e "—" não casa com
  // nenhuma área cadastrada.
  it('deixa a célula vazia quando a demanda não tem área resolvida', () => {
    const [linha] = montarLinhasCsvDemandas([{ ...base, areaNome: null }])
    expect(linha[1]).toBe('')
  })

  // Um nome de demanda é texto livre digitado por gestor. Sem a neutralização,
  // abrir o CSV executa a fórmula.
  it.each(['=SOMA(A1:A9)', '+1+1', '-2', '@SUM(1)', '=cmd|" /C calc"!A0'])(
    'neutraliza fórmula em %s',
    (nome) => {
      const [linha] = montarLinhasCsvDemandas([{ ...base, nome }])
      expect(linha[0]).toBe(`'${nome}`)
    }
  )

  it('neutraliza fórmula também no nome da área', () => {
    const [linha] = montarLinhasCsvDemandas([{ ...base, areaNome: '=HYPERLINK("http://x")' }])
    expect(linha[1].startsWith("'")).toBe(true)
  })

  // Prefixar número com apóstrofo transformaria a coluna em texto e quebraria
  // qualquer soma na planilha.
  it('não prefixa número negativo', () => {
    const [linha] = montarLinhasCsvDemandas([{ ...base, tempo_padrao_min: -30 }])
    expect(linha[2]).toBe('-30')
  })
})

describe('montarCsvDemandas', () => {
  it('começa com BOM UTF-8', () => {
    expect(montarCsvDemandas([])).toMatch(/^﻿/)
  })

  it('traz o cabeçalho mesmo sem nenhuma demanda', () => {
    expect(montarCsvDemandas([])).toContain('Nome,Área,Tempo padrão (min)')
  })

  it('separa linhas com CRLF', () => {
    const csv = montarCsvDemandas([base])
    expect(csv.split('\r\n')).toHaveLength(2)
  })

  it('escapa vírgula e aspas no nome', () => {
    const csv = montarCsvDemandas([{ ...base, nome: 'Suporte, nível "2"' }])
    expect(csv).toContain('"Suporte, nível ""2"""')
  })
})
