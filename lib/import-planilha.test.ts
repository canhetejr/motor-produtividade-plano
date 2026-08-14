import { describe, it, expect } from 'vitest'

import { lerPlanilha, faltandoColunas } from './import-planilha'
import { montarCsvDemandas } from './csv-demandas'

function csvFile(conteudo: string, nome = 'demandas.csv') {
  return new File([conteudo], nome, { type: 'text/csv' })
}

/** Bytes como o Excel em português grava: Windows-1252, não UTF-8. */
function csvFileWin1252(conteudo: string) {
  return new File([Buffer.from(conteudo, 'latin1')], 'demandas.csv', { type: 'text/csv' })
}

describe('lerPlanilha', () => {
  // O bug que motivou tudo isto: o arquivo exportado pelo próprio sistema não
  // voltava pelo import, e o relatório culpava o dado ("Área "" não
  // encontrada", cinquenta vezes) em vez do cabeçalho.
  it('lê de volta o CSV que o export de demandas gera', async () => {
    const csv = montarCsvDemandas([
      {
        nome: 'Agendar Gravações',
        areaNome: 'Produção',
        tempo_padrao_min: 30,
        variavel: false,
        blocos_totais: 1,
        finita: false,
        complexidade: null,
        ativo: true,
      },
    ])

    const { cabecalhos, linhas } = await lerPlanilha(csvFile(csv))

    expect(cabecalhos).toContain('area')
    expect(cabecalhos).toContain('tempo_padrao_min')
    expect(linhas).toHaveLength(1)
    expect(linhas[0].nome).toBe('Agendar Gravações')
    expect(linhas[0].area).toBe('Produção')
    expect(linhas[0].tempo_padrao_min).toBe('30')
    expect(linhas[0].variavel).toBe('Não')
  })

  it('aceita ponto e vírgula, que é o que o Excel em português grava', async () => {
    const csv = 'nome;area;tempo_padrao_min\r\nBriefing;Produção;45'
    const { linhas } = await lerPlanilha(csvFile(csv))

    expect(linhas).toEqual([{ nome: 'Briefing', area: 'Produção', tempo_padrao_min: '45' }])
  })

  // O arquivo que mais chega no import é o que passou pelo Excel — e o Excel
  // em português grava CSV em Windows-1252. Lido como UTF-8, "Produção" vira
  // "Produ\ufffd\ufffdo" e a linha falha acusando o dado, não a codificação.
  it('lê acento de arquivo salvo pelo Excel em Windows-1252', async () => {
    const { linhas } = await lerPlanilha(csvFileWin1252('nome;area\r\nBriefing;Produção'))
    expect(linhas[0].area).toBe('Produção')
  })

  it('desfaz o apóstrofo que o export põe contra fórmula', async () => {
    // O export escreve '+Vendas para o Excel não tratar como fórmula; sem
    // desfazer aqui, a área não casa na volta.
    const conteudo = ['nome,area', "'-Retrabalho,'+Vendas"].join('\r\n')
    const { linhas } = await lerPlanilha(csvFile(conteudo))
    expect(linhas[0].area).toBe('+Vendas')
    expect(linhas[0].nome).toBe('-Retrabalho')
  })

  it('ignora o BOM que o próprio export escreve', async () => {
    const { cabecalhos } = await lerPlanilha(csvFile('﻿nome,area\r\nA,B'))
    expect(cabecalhos[0]).toBe('nome')
  })

  it('descarta linha inteiramente vazia', async () => {
    const { linhas } = await lerPlanilha(csvFile('nome,area\r\nA,B\r\n,\r\n'))
    expect(linhas).toHaveLength(1)
  })
})

describe('faltandoColunas', () => {
  it('cita a coluna que falta e o cabeçalho que veio', () => {
    const mensagem = faltandoColunas(
      { cabecalhos: ['nome', 'tempo_padrao_min'], rotulos: ['Nome', 'Tempo padrão (min)'], linhas: [] },
      ['area', 'nome']
    )
    expect(mensagem).toContain('"area"')
    expect(mensagem).toContain('Nome, Tempo padrão (min)')
  })

  it('devolve null quando está tudo lá', () => {
    expect(
      faltandoColunas({ cabecalhos: ['area', 'nome'], rotulos: ['Área', 'Nome'], linhas: [] }, ['area', 'nome'])
    ).toBeNull()
  })
})
