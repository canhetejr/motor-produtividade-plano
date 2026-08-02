import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// A lista de aparelhos iOS vive em dois lugares: scripts/gerar-icones.mjs, que
// produz os PNGs, e app/layout.tsx, que os referencia. Se divergirem, o iOS não
// avisa — ele simplesmente não casa nenhum `media` e abre com tela branca, que é
// exatamente o defeito que as splash screens existem para resolver.

const raiz = resolve(__dirname, '..')

function aparelhos(arquivo: string): string[] {
  const texto = readFileSync(join(raiz, arquivo), 'utf8')
  const bloco = texto.match(/APARELHOS_IOS = \[([\s\S]*?)\n\]/)
  if (!bloco) throw new Error(`APARELHOS_IOS não encontrado em ${arquivo}`)
  return [...bloco[1].matchAll(/largura:\s*(\d+),\s*altura:\s*(\d+),\s*dpr:\s*(\d+)/g)]
    .map((m) => `${m[1]}x${m[2]}@${m[3]}`)
    .sort()
}

describe('splash screens do iOS', () => {
  const doScript = aparelhos('scripts/gerar-icones.mjs')
  const doLayout = aparelhos('app/layout.tsx')

  it('gerador e layout descrevem os mesmos aparelhos', () => {
    expect(doLayout).toEqual(doScript)
  })

  it('todo PNG referenciado existe em public/', () => {
    const faltando = doScript
      .map((a) => `public/icons/splash-${a.split('@')[0]}.png`)
      .filter((caminho) => !existsSync(join(raiz, caminho)))
    expect(faltando, `rode \`npm run icons\`: ${faltando.join(', ')}`).toEqual([])
  })

  it('cobre pelo menos um aparelho de cada densidade', () => {
    expect(doScript.some((a) => a.endsWith('@2'))).toBe(true)
    expect(doScript.some((a) => a.endsWith('@3'))).toBe(true)
  })
})
