import { describe, it, expect } from 'vitest'
import {
  gerarCodigo,
  hashCodigo,
  hashConfere,
  verificarCodigo,
  expiraEm,
  TAMANHO_CODIGO,
  MAX_TENTATIVAS,
  type Desafio,
} from './mfa'

const AGORA = new Date('2026-08-02T12:00:00Z')
const SAL = 'sal-fixo-de-teste'

const desafio = (over: Partial<Desafio> = {}): Desafio => ({
  codigoHash: hashCodigo('123456', SAL),
  sal: SAL,
  expiraEm: '2026-08-02T12:10:00Z',
  tentativas: 0,
  verificadoEm: null,
  ...over,
})

describe('gerarCodigo', () => {
  it('tem sempre o comprimento fixo', () => {
    for (let i = 0; i < 200; i++) {
      expect(gerarCodigo()).toHaveLength(TAMANHO_CODIGO)
    }
  })

  it('preserva zeros à esquerda', () => {
    // Cortá-los reduziria o espaço de busca.
    const codigos = Array.from({ length: 500 }, gerarCodigo)
    expect(codigos.every((c) => /^\d{6}$/.test(c))).toBe(true)
  })

  it('não repete de forma óbvia', () => {
    const conjunto = new Set(Array.from({ length: 200 }, gerarCodigo))
    expect(conjunto.size).toBeGreaterThan(150)
  })
})

describe('hashCodigo', () => {
  it('é determinístico com o mesmo sal', () => {
    expect(hashCodigo('123456', SAL)).toBe(hashCodigo('123456', SAL))
  })

  it('muda com o sal', () => {
    // Sem sal por desafio, quem lesse a tabela veria quais compartilham código.
    expect(hashCodigo('123456', 'sal-a')).not.toBe(hashCodigo('123456', 'sal-b'))
  })

  it('não guarda o código em claro', () => {
    expect(hashCodigo('123456', SAL)).not.toContain('123456')
  })
})

describe('hashConfere', () => {
  it('reconhece iguais', () => {
    const h = hashCodigo('123456', SAL)
    expect(hashConfere(h, h)).toBe(true)
  })

  it('recusa diferentes', () => {
    expect(hashConfere(hashCodigo('123456', SAL), hashCodigo('654321', SAL))).toBe(false)
  })

  it('não lança com comprimentos diferentes', () => {
    // timingSafeEqual lança nesse caso; a checagem de tamanho vem antes.
    expect(hashConfere('curto', hashCodigo('123456', SAL))).toBe(false)
  })
})

describe('verificarCodigo', () => {
  it('aceita o código certo', () => {
    expect(verificarCodigo(desafio(), '123456', AGORA)).toEqual({ ok: true })
  })

  it('tolera espaço em volta', () => {
    expect(verificarCodigo(desafio(), '  123456 ', AGORA)).toEqual({ ok: true })
  })

  it('recusa código errado', () => {
    expect(verificarCodigo(desafio(), '000000', AGORA)).toEqual({ ok: false, motivo: 'incorreto' })
  })

  it('recusa desafio inexistente', () => {
    expect(verificarCodigo(null, '123456', AGORA)).toEqual({ ok: false, motivo: 'inexistente' })
  })

  it('recusa desafio expirado', () => {
    const d = desafio({ expiraEm: '2026-08-02T11:59:59Z' })
    expect(verificarCodigo(d, '123456', AGORA)).toEqual({ ok: false, motivo: 'expirado' })
  })

  it('recusa no instante exato do vencimento', () => {
    const d = desafio({ expiraEm: '2026-08-02T12:00:00Z' })
    expect(verificarCodigo(d, '123456', AGORA).ok).toBe(false)
  })

  it('recusa desafio já usado', () => {
    const d = desafio({ verificadoEm: '2026-08-02T11:55:00Z' })
    expect(verificarCodigo(d, '123456', AGORA)).toEqual({ ok: false, motivo: 'usado' })
  })

  it('recusa por excesso de tentativas ANTES de comparar', () => {
    // Sem isso, a tentativa que estoura o limite ainda testaria um código.
    const d = desafio({ tentativas: MAX_TENTATIVAS })
    expect(verificarCodigo(d, '123456', AGORA)).toEqual({ ok: false, motivo: 'excedido' })
  })

  it('ainda aceita na última tentativa permitida', () => {
    const d = desafio({ tentativas: MAX_TENTATIVAS - 1 })
    expect(verificarCodigo(d, '123456', AGORA)).toEqual({ ok: true })
  })

  it('expirado vence excedido: a validade é a barreira mais antiga', () => {
    const d = desafio({ expiraEm: '2026-08-02T11:00:00Z', tentativas: MAX_TENTATIVAS })
    expect(verificarCodigo(d, '123456', AGORA).ok).toBe(false)
  })
})

describe('expiraEm', () => {
  it('soma a validade configurada', () => {
    expect(expiraEm(AGORA)).toBe('2026-08-02T12:10:00.000Z')
  })
})
