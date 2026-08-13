import { sanitizeFormula, escapeCsv } from '@/lib/csv'

// Montagem das linhas do CSV do catálogo de demandas, separada da rota para
// caber no vitest — mesmo motivo que levou sanitizeFormula/escapeCsv a saírem
// de app/api/export/route.ts.

export const CABECALHO_DEMANDAS = [
  'Nome',
  'Área',
  'Tempo padrão (min)',
  'Variável',
  'Blocos totais',
  'Finita',
  'Ativa',
] as const

export type DemandaExportavel = {
  nome: string
  areaNome: string | null
  tempo_padrao_min: number | null
  variavel: boolean
  blocos_totais: number
  finita: boolean
  ativo: boolean
}

// "Sim"/"Não" em vez de true/false: o CSV é aberto por gente, não por
// máquina, e o Excel em português exibe TRUE/FALSE sem traduzir.
const simNao = (v: boolean) => (v ? 'Sim' : 'Não')

/**
 * Só as colunas textuais passam por `sanitizeFormula` — número e booleano
 * nunca começam com `=`, `+`, `-` ou `@` na forma em que saem daqui. Aplicar a
 * todos por precaução prefixaria `-30` (tempo negativo, se algum dia existir)
 * com apóstrofo e quebraria a soma na planilha.
 */
export function montarLinhasCsvDemandas(demandas: DemandaExportavel[]): string[][] {
  return demandas.map((d) => [
    sanitizeFormula(d.nome),
    // Vazio, e não um traço: este arquivo volta pelo import, e "—" não casa
    // com nenhuma área cadastrada. Demanda sem área é impossível hoje
    // (area_id é NOT NULL), então a coluna vazia é caso de borda, não regra.
    sanitizeFormula(d.areaNome ?? ''),
    d.tempo_padrao_min === null ? '' : String(d.tempo_padrao_min),
    simNao(d.variavel),
    String(d.blocos_totais),
    simNao(d.finita),
    simNao(d.ativo),
  ])
}

/**
 * BOM UTF-8 na frente: sem ele o Excel no Windows lê o arquivo como Latin-1 e
 * "Manutenção" vira "ManutenÃ§Ã£o". Mesma decisão de app/api/export/route.ts.
 * CRLF entre linhas por RFC 4180.
 */
export function montarCsvDemandas(demandas: DemandaExportavel[]): string {
  const linhas = [[...CABECALHO_DEMANDAS], ...montarLinhasCsvDemandas(demandas)]
  return '﻿' + linhas.map((l) => l.map(escapeCsv).join(',')).join('\r\n')
}
