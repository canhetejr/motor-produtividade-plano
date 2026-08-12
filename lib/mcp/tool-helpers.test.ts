import { describe, expect, it } from 'vitest'
import { mensagemDeErro } from './tool-helpers'

describe('erros públicos MCP', () => {
  it('não expõe detalhe interno do banco para o cliente MCP', () => {
    const interno = new Error('relation public.mcp_tokens does not exist')

    expect(mensagemDeErro(interno, 'Não foi possível concluir a consulta.')).toBe(
      'Não foi possível concluir a consulta.'
    )
  })
})
