import ExcelJS from 'exceljs'
import uuidPackage from 'uuid/package.json'
import { describe, expect, it } from 'vitest'

import { gerarXlsxApontamentos } from './route'

describe('compatibilidade da dependência UUID', () => {
  it('usa a versão corrigida exigida pela auditoria', () => {
    expect(uuidPackage.version).toBe('11.1.1')
  })
})

describe('gerarXlsxApontamentos', () => {
  it('gera um XLSX legível com abas, cabeçalho, dados e resumo', async () => {
    const arquivo = await gerarXlsxApontamentos('2026-08-01', '2026-08-07', [
      ['id-1', '2026-08-01', 'Luiz', 'Produção', 'Gravação', 2, 510, 'Entrega', 'Finalizado'],
    ])

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arquivo as never)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Apontamentos', 'Resumo'])
    expect(workbook.getWorksheet('Apontamentos')?.getRow(1).values).toContain('Tempo Entregue (min)')
    expect(workbook.getWorksheet('Apontamentos')?.getRow(2).getCell(5).value).toBe('Gravação')
    expect(workbook.getWorksheet('Apontamentos')?.autoFilter).toBe('A1:I1')
    expect(workbook.getWorksheet('Resumo')?.getRow(3).getCell(2).value).toBe(1)
    expect(workbook.getWorksheet('Resumo')?.getRow(4).getCell(2).value).toBe(510)
  })
})
