import { describe, it, expect, vi } from 'vitest'
import { verificarSenhaVazada, mensagemDeRecusa } from './senha-vazada'

// SHA-1 de "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
// O corte e em 5 caracteres, entao o sufixo comeca em "1E4C" — conferido
// calculando o hash, nao copiado de cabeca.
const PREFIXO_PASSWORD = '5BAA6'
const SUFIXO_PASSWORD = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'

// Tipada como o proprio fetch para o mock carregar a assinatura — sem isso o
// TypeScript infere a tupla de argumentos como vazia e mock.calls[0][0] nao
// existe.
function respostaFalsa(corpo: string, ok = true) {
  return vi.fn<typeof fetch>(async () => ({ ok, text: async () => corpo }) as unknown as Response)
}

describe('verificarSenhaVazada', () => {
  it('detecta senha presente na lista', async () => {
    const buscar = respostaFalsa(`${SUFIXO_PASSWORD}:12345\nAAAA:1`)
    const r = await verificarSenhaVazada('password', buscar)
    expect(r).toEqual({ vazada: true, ocorrencias: 12345 })
  })

  it('só envia os 5 primeiros caracteres do hash', async () => {
    // K-anonimato: a senha e o hash completo nunca trafegam.
    const buscar = respostaFalsa('AAAA:1')
    await verificarSenhaVazada('password', buscar)
    const url = String(buscar.mock.calls[0][0])
    // Assercao sobre o CAMINHO, nao sobre a URL inteira: o dominio
    // api.pwnedpasswords.com contem literalmente a substring "password", o que
    // faria um `not.toContain('password')` sobre a URL falhar sem motivo.
    const caminho = new URL(url).pathname
    expect(caminho).toBe(`/range/${PREFIXO_PASSWORD}`)
    expect(url).not.toContain(SUFIXO_PASSWORD)
  })

  it('aceita senha ausente da lista', async () => {
    const r = await verificarSenhaVazada('senha-muito-particular', respostaFalsa('AAAA:1\nBBBB:2'))
    expect(r).toEqual({ vazada: false })
  })

  it('ignora entrada de padding com contagem zero', async () => {
    // A API devolve sufixos falsos com contagem 0 quando Add-Padding está ligado.
    const r = await verificarSenhaVazada('password', respostaFalsa(`${SUFIXO_PASSWORD}:0`))
    expect(r).toEqual({ vazada: false })
  })

  it('reporta indisponivel quando a API falha', async () => {
    const r = await verificarSenhaVazada('password', respostaFalsa('', false))
    expect(r).toEqual({ indisponivel: true })
  })

  it('reporta indisponivel quando a rede estoura', async () => {
    const buscar = vi.fn(async () => {
      throw new Error('timeout')
    }) as unknown as typeof fetch
    expect(await verificarSenhaVazada('password', buscar)).toEqual({ indisponivel: true })
  })

  it('tolera espaço e linha vazia na resposta', async () => {
    const r = await verificarSenhaVazada('password', respostaFalsa(`\r\n  ${SUFIXO_PASSWORD}:7  \r\n\r\n`))
    expect(r).toEqual({ vazada: true, ocorrencias: 7 })
  })
})

describe('mensagemDeRecusa', () => {
  it('recusa senha vazada com a contagem', () => {
    expect(mensagemDeRecusa({ vazada: true, ocorrencias: 1000 })).toContain('1.000')
  })

  it('aceita senha limpa', () => {
    expect(mensagemDeRecusa({ vazada: false })).toBeNull()
  })

  it('NÃO bloqueia quando a API está fora', () => {
    // Deixar alguém sem conseguir criar usuário porque um serviço de terceiro
    // caiu é pior que aceitar uma senha que talvez esteja numa lista.
    expect(mensagemDeRecusa({ indisponivel: true })).toBeNull()
  })
})
