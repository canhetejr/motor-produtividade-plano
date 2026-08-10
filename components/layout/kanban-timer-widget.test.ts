import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'components/layout/kanban-timer-widget.tsx'), 'utf8')

describe('timer do Kanban', () => {
  it('usa a cor primária da Tera para os controles de foco', () => {
    expect(source).toContain('bg-primary text-primary-foreground shadow-sm')
    expect(source).toContain('tracking-[0.18em] text-foreground')
    expect(source).toContain('tracking-[0.25em] text-foreground')
    expect(source).toContain('bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground')
    expect(source).not.toContain('bg-success text-success-foreground shadow-sm')
  })
})
