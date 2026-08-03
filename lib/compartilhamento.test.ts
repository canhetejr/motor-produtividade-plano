import { describe, it, expect } from 'vitest'
import { verificarLink, tokenBemFormado, paraPublico } from './compartilhamento'

const AGORA = new Date('2026-08-02T12:00:00Z')

describe('verificarLink', () => {
  it('aceita link ativo e sem validade', () => {
    expect(verificarLink({ quadroId: 'q1', ativo: true, expiraEm: null }, AGORA)).toEqual({
      valido: true,
      quadroId: 'q1',
    })
  })

  it('recusa token inexistente', () => {
    expect(verificarLink(null, AGORA)).toEqual({ valido: false, motivo: 'inexistente' })
  })

  it('recusa link revogado', () => {
    expect(verificarLink({ quadroId: 'q1', ativo: false, expiraEm: null }, AGORA)).toEqual({
      valido: false,
      motivo: 'revogado',
    })
  })

  it('recusa link expirado', () => {
    expect(
      verificarLink({ quadroId: 'q1', ativo: true, expiraEm: '2026-08-01T00:00:00Z' }, AGORA)
    ).toEqual({ valido: false, motivo: 'expirado' })
  })

  it('recusa no instante exato do vencimento', () => {
    // Vencimento e fim de validade, nao ultimo instante valido.
    expect(
      verificarLink({ quadroId: 'q1', ativo: true, expiraEm: '2026-08-02T12:00:00Z' }, AGORA).valido
    ).toBe(false)
  })

  it('aceita um segundo antes de vencer', () => {
    expect(
      verificarLink({ quadroId: 'q1', ativo: true, expiraEm: '2026-08-02T12:00:01Z' }, AGORA).valido
    ).toBe(true)
  })

  it('revogado vence expirado na mensagem', () => {
    // Revogar e ato deliberado; dizer "expirou" esconderia isso de quem revogou.
    expect(
      verificarLink({ quadroId: 'q1', ativo: false, expiraEm: '2020-01-01T00:00:00Z' }, AGORA)
    ).toEqual({ valido: false, motivo: 'revogado' })
  })
})

describe('tokenBemFormado', () => {
  it('aceita o formato que geramos', () => {
    expect(tokenBemFormado('a'.repeat(64))).toBe(true)
    expect(tokenBemFormado('0123456789abcdef'.repeat(4))).toBe(true)
  })

  it('recusa comprimento errado', () => {
    expect(tokenBemFormado('a'.repeat(63))).toBe(false)
    expect(tokenBemFormado('a'.repeat(65))).toBe(false)
  })

  it('recusa caractere fora do hexadecimal', () => {
    expect(tokenBemFormado('g'.repeat(64))).toBe(false)
    expect(tokenBemFormado('A'.repeat(64))).toBe(false)
  })

  it('recusa tentativa de injecao e string vazia', () => {
    // Este caminho roda com cliente de servico; validar a forma antes de
    // consultar fecha a porta.
    expect(tokenBemFormado("' or '1'='1")).toBe(false)
    expect(tokenBemFormado('')).toBe(false)
  })
})

describe('paraPublico', () => {
  const interno = {
    codigo: 'KAN-7',
    titulo: 'Revisar roteiro',
    prazo: '2026-08-10',
    entregue_em: null,
    descricao: '<p>combinado interno sigiloso</p>',
    responsaveis: ['pessoa-1'],
    tempo_estimado_min: 120,
    centro_id: 'segredo',
  }

  it('expoe so o que foi decidido expor', () => {
    const publico = paraPublico(interno, 'Em revisão')
    expect(Object.keys(publico).sort()).toEqual(['codigo', 'coluna', 'entregue', 'prazo', 'titulo'])
  })

  it('nao vaza descricao, responsaveis nem campos internos', () => {
    const publico = paraPublico(interno, 'Em revisão') as Record<string, unknown>
    expect(publico.descricao).toBeUndefined()
    expect(publico.responsaveis).toBeUndefined()
    expect(publico.centro_id).toBeUndefined()
    expect(publico.tempo_estimado_min).toBeUndefined()
  })

  it('campo novo no card nao vaza por padrao', () => {
    // Lista de permissao, nao de exclusao: uma lista de exclusao exigiria
    // lembrar de atualiza-la a cada coluna nova.
    const comCampoNovo = { ...interno, campo_inventado_amanha: 'sigiloso' }
    const publico = paraPublico(comCampoNovo, 'X') as Record<string, unknown>
    expect(publico.campo_inventado_amanha).toBeUndefined()
  })

  it('deriva entregue de entregue_em', () => {
    expect(paraPublico(interno, 'X').entregue).toBe(false)
    expect(paraPublico({ ...interno, entregue_em: '2026-08-01' }, 'X').entregue).toBe(true)
  })
})
