import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { origemDaRequisicao, resolverBaseUrl } from './base-url'

function req(headers: Record<string, string>) {
  return new Request('http://interno.local/api/google/connect', { headers })
}

const original = process.env.NEXT_PUBLIC_APP_URL

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = original
})

describe('origemDaRequisicao', () => {
  it('usa os cabeçalhos que o proxy preenche', () => {
    expect(
      origemDaRequisicao(req({ 'x-forwarded-host': 'vertice.teralabs.cloud', 'x-forwarded-proto': 'https' }))
    ).toBe('https://vertice.teralabs.cloud')
  })

  it('cai no host quando não há x-forwarded-host', () => {
    expect(origemDaRequisicao(req({ host: 'vertice.teralabs.cloud' }))).toBe('https://vertice.teralabs.cloud')
  })

  it('assume http em host local, https no resto', () => {
    expect(origemDaRequisicao(req({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
  })
})

describe('resolverBaseUrl', () => {
  // O caso que motivou o arquivo: a variável ficou com o valor do .env de
  // desenvolvimento, e o Google devolvia a pessoa para 0.0.0.0:3000.
  it('ignora endereço local no ambiente quando a requisição é pública', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://0.0.0.0:3000'
    expect(resolverBaseUrl(req({ host: 'vertice.teralabs.cloud' }))).toBe('https://vertice.teralabs.cloud')
  })

  it('respeita a variável quando ela aponta para um domínio de verdade', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://vertice.teralabs.cloud/'
    // Barra final removida: ela viraria "//api/google/callback".
    expect(resolverBaseUrl(req({ host: 'outro.exemplo' }))).toBe('https://vertice.teralabs.cloud')
  })

  it('em desenvolvimento, os dois são locais e nada muda', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    expect(resolverBaseUrl(req({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
  })

  it('sem variável nenhuma, usa a requisição', () => {
    expect(resolverBaseUrl(req({ host: 'vertice.teralabs.cloud' }))).toBe('https://vertice.teralabs.cloud')
  })

  it('sem variável e sem host, falha em vez de inventar um domínio', () => {
    const semHost = new Request('http://interno.local/x')
    semHost.headers.delete('host')
    expect(() => resolverBaseUrl(semHost)).toThrow(/NEXT_PUBLIC_APP_URL/)
  })
})
