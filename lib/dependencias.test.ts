import { describe, it, expect } from 'vitest'
import {
  alcanca,
  validarDependencia,
  bloqueadoresPendentes,
  estaBloqueado,
  type Aresta,
} from './dependencias'

// A depende de B, B depende de C  =>  A -> B -> C
const cadeia: Aresta[] = [
  { cartaoId: 'A', dependeDe: 'B' },
  { cartaoId: 'B', dependeDe: 'C' },
]

describe('alcanca', () => {
  it('encontra vizinho direto', () => {
    expect(alcanca(cadeia, 'A', 'B')).toBe(true)
  })

  it('encontra por caminho indireto', () => {
    expect(alcanca(cadeia, 'A', 'C')).toBe(true)
  })

  it('não inventa caminho na direção contrária', () => {
    expect(alcanca(cadeia, 'C', 'A')).toBe(false)
  })

  it('devolve falso em grafo vazio', () => {
    expect(alcanca([], 'A', 'B')).toBe(false)
  })

  it('termina mesmo se o grafo já contiver um ciclo', () => {
    // Dado legado ou gravado por fora. Sem o conjunto de visitados isto seria
    // laço infinito, não resposta.
    const ciclico: Aresta[] = [
      { cartaoId: 'A', dependeDe: 'B' },
      { cartaoId: 'B', dependeDe: 'A' },
    ]
    expect(alcanca(ciclico, 'A', 'Z')).toBe(false)
  })
})

describe('validarDependencia', () => {
  it('aceita dependência nova sem ciclo', () => {
    expect(validarDependencia(cadeia, 'D', 'A')).toEqual({ ok: true })
  })

  it('recusa card dependendo de si mesmo', () => {
    const r = validarDependencia(cadeia, 'A', 'A')
    expect(r.ok).toBe(false)
  })

  it('recusa duplicata', () => {
    const r = validarDependencia(cadeia, 'A', 'B')
    expect(r).toEqual({ ok: false, motivo: 'Essa dependência já existe.' })
  })

  it('recusa ciclo direto', () => {
    // B já depende de C; fazer C depender de B fecharia o par.
    const r = validarDependencia(cadeia, 'C', 'B')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toContain('ciclo')
  })

  it('recusa ciclo longo', () => {
    // A -> B -> C; fazer C depender de A fecharia o triângulo.
    const r = validarDependencia(cadeia, 'C', 'A')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toContain('ciclo')
  })

  it('permite dois cards dependerem do mesmo terceiro', () => {
    // Não é ciclo: é convergência, e é comum.
    expect(validarDependencia(cadeia, 'D', 'C')).toEqual({ ok: true })
  })

  it('permite um card ter várias dependências', () => {
    expect(validarDependencia(cadeia, 'A', 'C')).toEqual({ ok: true })
  })
})

describe('bloqueadoresPendentes', () => {
  it('lista só o que ainda não foi concluído', () => {
    const arestas: Aresta[] = [
      { cartaoId: 'A', dependeDe: 'B' },
      { cartaoId: 'A', dependeDe: 'C' },
    ]
    expect(bloqueadoresPendentes(arestas, 'A', new Set(['B']))).toEqual(['C'])
  })

  it('devolve vazio quando tudo foi concluído', () => {
    expect(bloqueadoresPendentes(cadeia, 'A', new Set(['B']))).toEqual([])
  })

  it('não considera dependência transitiva', () => {
    // A depende de B, que depende de C. Com B concluído, A destrava — mesmo
    // que C não esteja. Mostrar a cadeia inteira na face do card seria ruído.
    expect(estaBloqueado(cadeia, 'A', new Set(['B']))).toBe(false)
  })

  it('card sem dependência nunca está bloqueado', () => {
    expect(estaBloqueado(cadeia, 'Z', new Set())).toBe(false)
  })
})
