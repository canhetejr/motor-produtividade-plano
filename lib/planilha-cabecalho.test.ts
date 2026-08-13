import { describe, it, expect } from 'vitest'

import { chaveDeColuna, detectarSeparador, lerBooleano, normalizarCabecalho } from './planilha-cabecalho'

describe('normalizarCabecalho', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizarCabecalho('Área')).toBe('area')
    expect(normalizarCabecalho('Tempo padrão (min)')).toBe('tempo_padrao_min')
    expect(normalizarCabecalho('  BLOCOS TOTAIS  ')).toBe('blocos_totais')
    expect(normalizarCabecalho('Variável')).toBe('variavel')
  })

  it('mantém quem já está na forma canônica', () => {
    expect(normalizarCabecalho('nome')).toBe('nome')
    expect(normalizarCabecalho('carga_horaria_min')).toBe('carga_horaria_min')
  })
})

describe('chaveDeColuna', () => {
  // O cabeçalho do export é escrito para gente ler; o import precisa
  // reconhecê-lo de volta, ou o arquivo que o próprio sistema gerou não entra.
  it('traduz o cabeçalho do export de demandas', () => {
    const exportado = ['Nome', 'Área', 'Tempo padrão (min)', 'Variável', 'Blocos totais', 'Finita', 'Ativa']
    expect(exportado.map(chaveDeColuna)).toEqual([
      'nome',
      'area',
      'tempo_padrao_min',
      'variavel',
      'blocos_totais',
      'finita',
      'ativo',
    ])
  })

  it('aceita sinônimos comuns', () => {
    expect(chaveDeColuna('E-mail')).toBe('email')
    expect(chaveDeColuna('Perfil')).toBe('role')
    expect(chaveDeColuna('Carga horária')).toBe('carga_horaria_min')
    expect(chaveDeColuna('Senha inicial')).toBe('senha')
  })
})

describe('lerBooleano', () => {
  it('entende as formas que aparecem em planilha', () => {
    for (const v of ['Sim', 'sim', 'SIM', 'true', 'TRUE', '1', 'x', 'Yes']) {
      expect(lerBooleano(v), v).toBe(true)
    }
    for (const v of ['Não', 'nao', 'false', '0', 'qualquer coisa']) {
      expect(lerBooleano(v), v).toBe(false)
    }
  })

  it('cai no padrão quando a célula está vazia', () => {
    expect(lerBooleano('')).toBe(false)
    expect(lerBooleano(undefined, true)).toBe(true)
  })
})

describe('detectarSeparador', () => {
  it('reconhece o ponto e vírgula que o Excel em português grava', () => {
    expect(detectarSeparador('Nome;Área;Tempo padrão (min)')).toBe(';')
  })

  it('reconhece vírgula, tabulação e pipe', () => {
    expect(detectarSeparador('nome,area,tempo_padrao_min')).toBe(',')
    expect(detectarSeparador('nome\tarea\ttempo')).toBe('\t')
    expect(detectarSeparador('nome|area|tempo')).toBe('|')
  })

  it('ignora separador dentro de aspas', () => {
    // A vírgula aparece 3x, mas toda dentro de um campo entre aspas: quem
    // separa as colunas é o ponto e vírgula.
    expect(detectarSeparador('"Nome, completo";"Área, da vez";"a, b"')).toBe(';')
  })

  it('assume vírgula quando há uma coluna só', () => {
    expect(detectarSeparador('nome')).toBe(',')
  })
})
