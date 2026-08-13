import 'server-only'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'

import { chaveDeColuna, detectarSeparador, limparCelula } from './planilha-cabecalho'

/**
 * Texto do CSV, custe o que custar.
 *
 * O Excel em português salva "CSV (separado por vírgulas)" em Windows-1252,
 * não em UTF-8 — e é justamente esse arquivo, o de `;`, que mais chega aqui.
 * Lido como UTF-8, "Produção" vira "Produ��o" e a linha falha com
 * `Área "Produ??o" não encontrada`: de novo um erro que culpa o dado.
 *
 * `fatal: true` é o que transforma "bytes que não são UTF-8" em decisão
 * explícita em vez de caractere de substituição silencioso. Texto acentuado
 * em Windows-1252 quase nunca é UTF-8 válido, então a exceção é um sinal
 * confiável — e o caminho normal (arquivo em UTF-8, inclusive o que este
 * sistema exporta) nem chega a passar pelo catch.
 */
function decodificarCsv(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

export type PlanilhaLida = {
  /** Chaves normalizadas do cabeçalho, na ordem em que aparecem. */
  cabecalhos: string[]
  /** Rótulos originais, para a mensagem de erro citar o que a pessoa vê. */
  rotulos: string[]
  linhas: Record<string, string>[]
}

// Lê CSV ou XLSX (mesma lib já usada em app/api/export/route.ts, só que pra
// leitura) e devolve as linhas como objetos chaveados pelo cabeçalho
// normalizado — ver lib/planilha-cabecalho.ts para o que "normalizado"
// significa e por quê.
export async function lerPlanilha(file: File): Promise<PlanilhaLida> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')

  if (isCsv) {
    // BOM UTF-8 na frente é o que o próprio export escreve (e o que o Excel
    // grava): sem removê-lo, a primeira coluna do cabeçalho vira "﻿nome"
    // e nunca casa com nada.
    let texto = decodificarCsv(buffer)
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1)

    const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? ''
    const delimiter = detectarSeparador(primeiraLinha)

    // Readable.from([texto]) emite tudo como um único chunk —
    // Readable.from(texto) trataria a string como iterável caractere a
    // caractere.
    await workbook.csv.read(Readable.from([texto]), { parserOptions: { delimiter } })
  } else {
    // node_modules/exceljs/index.d.ts declara seu próprio
    // `interface Buffer extends ArrayBuffer {}` global, que colide com o
    // Buffer genérico do @types/node atual (mistura de declarações exige
    // propriedades de ArrayBuffer redimensionável que um Buffer real não
    // tem estaticamente). `any` aqui é só pra contornar esse defeito de
    // tipos do pacote — o valor em runtime é um Buffer válido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any)
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return { cabecalhos: [], rotulos: [], linhas: [] }

  const chavePorColuna: string[] = []
  const cabecalhos: string[] = []
  const rotulos: string[] = []
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rotulo = limparCelula(String(cell.value ?? ''))
    if (rotulo === '') return
    const chave = chaveDeColuna(rotulo)
    chavePorColuna[colNumber] = chave
    cabecalhos.push(chave)
    rotulos.push(rotulo)
  })

  const linhas: Record<string, string>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: Record<string, string> = {}
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = chavePorColuna[colNumber]
      if (key) obj[key] = limparCelula(String(cell.value ?? ''))
    })
    if (Object.values(obj).some((v) => v !== '')) linhas.push(obj)
  })

  return { cabecalhos, rotulos, linhas }
}

/**
 * Mensagem para o caso em que o arquivo é legível mas o cabeçalho não é o
 * esperado. Recusar a importação inteira aqui é melhor do que deixar cada
 * linha falhar por conta própria: cinquenta erros iguais dizendo
 * `Área "" não encontrada` escondem que o problema era a coluna, e sugerem
 * que o dado está errado quando ele está certo.
 */
export function faltandoColunas(
  planilha: PlanilhaLida,
  obrigatorias: string[]
): string | null {
  const faltando = obrigatorias.filter((c) => !planilha.cabecalhos.includes(c))
  if (faltando.length === 0) return null

  const encontrados = planilha.rotulos.length > 0 ? planilha.rotulos.join(', ') : '(nenhum)'
  return (
    `O arquivo não tem ${faltando.length > 1 ? 'as colunas' : 'a coluna'} ` +
    `${faltando.map((c) => `"${c}"`).join(', ')}. ` +
    `Cabeçalho encontrado: ${encontrados}.`
  )
}

export type LinhaImportResultado = {
  linha: number
  nome: string
  status: 'ok' | 'erro'
  /** O que aconteceu com a linha que deu certo. Distinguir criar de atualizar
   *  é o que permite subir o arquivo exportado de volta sem ficar em dúvida se
   *  o import duplicou o catálogo. */
  acao?: 'criado' | 'atualizado'
  motivo?: string
}
