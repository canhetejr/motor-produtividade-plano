import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Três vezes nesta base uma classe ou token foi documentado e nunca
// implementado — `.custom-scrollbar` (16 usos, no-op), `--gradient-halo` (o
// fundo da tela de entrada, que simplesmente não renderizava) — ou o contrário,
// implementado e nunca usado (`.scroll-fade-x`, `.pattern-mesh`). Nenhum dos
// casos quebra build, tipo ou lint: falham em silêncio, na tela. Estes testes
// são o único ponto que os pega.

const raiz = resolve(__dirname, '..')
const css = readFileSync(join(raiz, 'app/globals.css'), 'utf8')
const manual = readFileSync(join(raiz, 'design.md'), 'utf8')

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, acc)
    else if (/\.(tsx?|mjs)$/.test(caminho)) acc.push(caminho)
  }
  return acc
}

const codigo = [join(raiz, 'app'), join(raiz, 'components'), join(raiz, 'lib')]
  .flatMap((d) => arquivosDeCodigo(d))
  .filter((f) => !f.endsWith('.test.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

describe('classes utilitárias do globals.css', () => {
  // Só as classes "de produto" declaradas em @layer components. Pseudo-elemento
  // e variante de tema (.dark .x) são a mesma classe, por isso o Set.
  const declaradas = new Set(
    [...css.matchAll(/^\s*(?:\.dark\s+)?\.([a-z][a-z0-9-]*)[\s,{:]/gm)].map((m) => m[1])
  )

  it('não deixa classe definida sem nenhum consumidor', () => {
    const orfas = [...declaradas].filter((c) => !codigo.includes(c))
    expect(orfas, `classes definidas no CSS e nunca usadas: ${orfas.join(', ')}`).toEqual([])
  })
})

describe('tokens do design.md', () => {
  // Documentados só como referência de marca, sem contraparte em CSS.
  const SO_DOCUMENTACAO = new Set([
    '--radius-app', // só o gerador de ícones
    '--space-1', // aparecem num exemplo de CSS do manual; o projeto usa a
    '--space-5', // escala de espaçamento do Tailwind, sem tokens próprios
  ])

  it('todo token documentado existe no CSS', () => {
    const documentados = new Set(
      [...manual.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1])
    )
    const ausentes = [...documentados].filter(
      (t) => !SO_DOCUMENTACAO.has(t) && !css.includes(t)
    )
    expect(
      ausentes,
      `tokens no design.md sem definição em globals.css: ${ausentes.join(', ')}`
    ).toEqual([])
  })
})
