import { describe, it, expect } from 'vitest'
import { resolverMeta, cumprimento, bateuMeta, META_PADRAO, type Meta } from './metas'

const HOJE = '2026-08-02'
const meta = (over: Partial<Meta> = {}): Meta => ({
  colaborador_id: null,
  area_id: null,
  alvo: 1,
  vigente_desde: '2026-01-01',
  ...over,
})

describe('resolverMeta', () => {
  it('cai no padrão sem nenhuma meta cadastrada', () => {
    expect(resolverMeta([], 'p1', 'a1', HOJE)).toEqual({ alvo: META_PADRAO, origem: 'padrao' })
  })

  it('usa a meta da área quando não há individual', () => {
    const metas = [meta({ area_id: 'a1', alvo: 0.9 })]
    expect(resolverMeta(metas, 'p1', 'a1', HOJE)).toEqual({ alvo: 0.9, origem: 'area' })
  })

  it('a meta da pessoa vence a da área', () => {
    // Definir meta de área não pode desfazer o acerto individual.
    const metas = [meta({ area_id: 'a1', alvo: 0.9 }), meta({ colaborador_id: 'p1', alvo: 1.2 })]
    expect(resolverMeta(metas, 'p1', 'a1', HOJE)).toEqual({ alvo: 1.2, origem: 'colaborador' })
  })

  it('ignora meta de outra pessoa e de outra área', () => {
    const metas = [meta({ colaborador_id: 'p2', alvo: 2 }), meta({ area_id: 'a9', alvo: 3 })]
    expect(resolverMeta(metas, 'p1', 'a1', HOJE).origem).toBe('padrao')
  })

  it('ignora meta que ainda não entrou em vigência', () => {
    const metas = [meta({ colaborador_id: 'p1', alvo: 1.5, vigente_desde: '2026-09-01' })]
    expect(resolverMeta(metas, 'p1', 'a1', HOJE).origem).toBe('padrao')
  })

  it('aceita meta que entra em vigência exatamente hoje', () => {
    const metas = [meta({ colaborador_id: 'p1', alvo: 1.5, vigente_desde: HOJE })]
    expect(resolverMeta(metas, 'p1', 'a1', HOJE).alvo).toBe(1.5)
  })

  it('entre várias vigentes, vale a mais recente', () => {
    // É a última decisão tomada, não a primeira.
    const metas = [
      meta({ colaborador_id: 'p1', alvo: 1, vigente_desde: '2026-01-01' }),
      meta({ colaborador_id: 'p1', alvo: 1.3, vigente_desde: '2026-07-01' }),
    ]
    expect(resolverMeta(metas, 'p1', 'a1', HOJE).alvo).toBe(1.3)
  })

  it('funciona para quem não tem área', () => {
    const metas = [meta({ area_id: 'a1', alvo: 0.8 })]
    expect(resolverMeta(metas, 'p1', null, HOJE).origem).toBe('padrao')
  })
})

describe('cumprimento', () => {
  it('vale 1 quando bate exatamente', () => {
    expect(cumprimento(0.9, 0.9)).toBe(1)
  })

  it('escala pela meta, não pelo índice bruto', () => {
    // 80% de entrega contra meta de 80% é 100% de cumprimento.
    expect(cumprimento(0.8, 0.8)).toBe(1)
    expect(cumprimento(0.8, 1)).toBeCloseTo(0.8)
  })

  it('não devolve Infinity com alvo zero', () => {
    // O check da tabela impede alvo zero, mas dado alterado por fora chegaria
    // à tela como "Infinity%".
    expect(cumprimento(1, 0)).toBe(0)
  })
})

describe('bateuMeta', () => {
  it('reconhece o limite exato', () => {
    expect(bateuMeta(0.9, 0.9)).toBe(true)
    expect(bateuMeta(0.89, 0.9)).toBe(false)
  })
})
