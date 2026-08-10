import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/email.ts'), 'utf8')

describe('layout de e-mail da Tera', () => {
  it('usa acid e ink da Tera nos elementos de marca', () => {
    expect(source).toContain('rgba(215,247,91,0.16)')
    expect(source).toContain('color:#101010;text-decoration:none;font-weight:600')
    expect(source).not.toContain('rgba(130,10,209')
    expect(source).not.toContain('#6b21a8')
  })
})
