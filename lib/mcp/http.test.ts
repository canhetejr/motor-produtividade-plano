import { describe, expect, it } from 'vitest'
import { cabecalhosMcp, respostaMcpNaoAutorizado, respostaMetodoMcpNaoPermitido } from './http'

describe('contrato HTTP público do MCP', () => {
  it('bloqueia método não suportado e anuncia POST no header Allow', async () => {
    const resposta = respostaMetodoMcpNaoPermitido()

    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('allow')).toBe('POST')
  })

  it('não revela estado interno do token em uma falha de autenticação', async () => {
    const resposta = respostaMcpNaoAutorizado()

    expect(resposta.status).toBe(401)
    expect(resposta.headers.get('www-authenticate')).toBe('Bearer')
    await expect(resposta.json()).resolves.toEqual({ error: 'Não autorizado.' })
  })

  it('inclui os headers de segurança e representação do endpoint', () => {
    const headers = cabecalhosMcp()

    expect(headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(headers.get('cache-control')).toBe('no-store')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
  })
})
