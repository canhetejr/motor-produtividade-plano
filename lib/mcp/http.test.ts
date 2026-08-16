import { describe, expect, it } from 'vitest'
import {
  LIMITE_CORPO_BYTES,
  cabecalhosMcp,
  origemPermitida,
  respostaMcpCorpoGrande,
  respostaMcpExcedeuLimite,
  respostaMcpNaoAutorizado,
  respostaMcpOrigemRecusada,
  respostaMetodoMcpNaoPermitido,
} from './http'

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

describe('proteção operacional do endpoint (Gate 3)', () => {
  it('recusa corpo grande com 413 e sem detalhe interno', async () => {
    const resposta = respostaMcpCorpoGrande()

    expect(resposta.status).toBe(413)
    expect(resposta.headers.get('cache-control')).toBe('no-store')
    await expect(resposta.json()).resolves.toEqual({ error: 'Corpo da requisição excede o limite.' })
  })

  it('o teto de corpo cabe folgado no maior payload que as tools aceitam', () => {
    // A maior chamada prevista é cartao_comentar, com conteúdo de até 5.000
    // caracteres. Se algum dia uma tool aceitar payload maior que o teto, este
    // teste é o lugar onde a conta tem que ser refeita.
    expect(LIMITE_CORPO_BYTES).toBeGreaterThan(5_000 * 4)
  })

  it('429 traz Retry-After em segundos, arredondado para cima', async () => {
    const resposta = respostaMcpExcedeuLimite(new Date(Date.now() + 4_200))

    expect(resposta.status).toBe(429)
    expect(resposta.headers.get('retry-after')).toBe('5')
    await expect(resposta.json()).resolves.toEqual({
      error: 'Muitas requisições. Tente novamente em instantes.',
    })
  })

  it('429 nunca manda Retry-After zero ou negativo', () => {
    // Janela já vencida entre o cálculo no banco e a resposta: sem o piso, o
    // cliente leria "0" e repetiria imediatamente, virando o laço que o
    // limite existe para conter.
    const vencida = respostaMcpExcedeuLimite(new Date(Date.now() - 10_000))
    const semJanela = respostaMcpExcedeuLimite(null)

    expect(Number(vencida.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(Number(semJanela.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('deixa passar requisição sem Origin — é o caso do cliente MCP', () => {
    expect(origemPermitida(new Headers())).toBe(true)
  })

  it('aceita Origin dos domínios do Vértice e recusa o resto', () => {
    expect(origemPermitida(new Headers({ origin: 'https://vertice.teralabs.cloud' }))).toBe(true)
    expect(origemPermitida(new Headers({ origin: 'https://dev.vertice.teralabs.cloud' }))).toBe(true)
    expect(origemPermitida(new Headers({ origin: 'https://evil.example' }))).toBe(false)
    // Sufixo parecido não vale: o casamento é exato, não "termina com".
    expect(origemPermitida(new Headers({ origin: 'https://vertice.teralabs.cloud.evil.example' }))).toBe(false)
    expect(origemPermitida(new Headers({ origin: 'http://vertice.teralabs.cloud' }))).toBe(false)
  })

  it('origem recusada responde 403 sem dizer quais origens valem', async () => {
    const resposta = respostaMcpOrigemRecusada()

    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toEqual({ error: 'Origem não permitida.' })
  })
})
