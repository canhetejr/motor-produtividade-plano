import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const actions = readFileSync(
  fileURLToPath(new URL('./actions.ts', import.meta.url)),
  'utf8'
)

describe('limite de avatar', () => {
  it('aceita até 10 MB também na validação do servidor', () => {
    expect(actions).toContain('const AVATAR_MAX_BYTES = 10 * 1024 * 1024')
    expect(actions).toContain('máximo 10MB')
  })
})
