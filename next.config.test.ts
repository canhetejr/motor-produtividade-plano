import { describe, expect, it } from 'vitest'
import config from './next.config'
import { revalidate } from './app/(marketing)/page'

describe('headers de segurança e cache', () => {
  it('declara uma política de segurança para todas as rotas', async () => {
    expect(config.headers).toBeTypeOf('function')

    const regras = await config.headers!()
    const headers = new Map(regras.find((regra) => regra.source === '/:path*')?.headers.map((header) => [header.key, header.value]))

    expect(headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=63072000')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('aceita o avatar máximo anunciado pela interface no Server Action', () => {
    expect(config.experimental?.serverActions?.bodySizeLimit).toBe('2mb')
  })

  it('revalida a landing em até cinco minutos', () => {
    expect(revalidate).toBe(300)
  })
})
