import { describe, expect, it } from 'vitest'
import { validarDadosAssinaturaManual } from './assinaturas-manuais'

describe('validarDadosAssinaturaManual', () => {
  it('normaliza uma assinatura comercial manual válida antes de qualquer mutação', () => {
    expect(
      validarDadosAssinaturaManual({
        planoId: '  9b590cb7-c6f3-449d-914c-18d2f319f4d5  ',
        status: 'ativa',
        cicloCobranca: 'mensal',
        iniciaEm: '2026-08-01',
        renovaEm: '2026-09-01',
        proximaCobrancaEm: '2026-09-01',
        valorCentavos: '12990',
        observacoes: '  Contrato comercial assinado.  ',
      })
    ).toEqual({
      ok: true,
      data: {
        planoId: '9b590cb7-c6f3-449d-914c-18d2f319f4d5',
        status: 'ativa',
        cicloCobranca: 'mensal',
        iniciaEm: '2026-08-01',
        renovaEm: '2026-09-01',
        proximaCobrancaEm: '2026-09-01',
        valorCentavos: 12990,
        observacoes: 'Contrato comercial assinado.',
      },
    })
  })
})
