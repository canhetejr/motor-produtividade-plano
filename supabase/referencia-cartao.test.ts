import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  fileURLToPath(new URL('./migrations/20260820200000_referencia_global_cartoes.sql', import.meta.url)),
  'utf8'
)

describe('referência global de cards', () => {
  it('gera VRT sequencial, único e imutável no banco', () => {
    expect(migration).toContain("create sequence if not exists public.cartoes_referencia_seq")
    expect(migration).toContain("new.referencia := 'VRT-' || lpad(nextval('public.cartoes_referencia_seq')::text, 6, '0')")
    expect(migration).toContain('add constraint cartoes_referencia_key unique (referencia)')
    expect(migration).toContain('cartoes_referencia_imutavel')
  })

  it('preserva o código anterior como alias de compatibilidade', () => {
    expect(migration).toContain('add column if not exists codigo_legado text')
    expect(migration).toContain('set codigo_legado = codigo')
    expect(migration).toContain('set codigo = referencia')
  })
})
