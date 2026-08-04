import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('./google-workspace', () => ({
  accessTokenFromRefreshToken: vi.fn(),
  decifrarToken: vi.fn(),
}))
vi.mock('../utils/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { sincronizarCartoesNoGoogle, type ResultadoSincronizacaoGoogle } from './google-calendar'

describe('lote de sincronização do Google Calendar', () => {
  afterEach(() => vi.restoreAllMocks())

  it('remove ids duplicados, limita concorrência e agrega resultados', async () => {
    let emExecucao = 0
    let maximoEmExecucao = 0
    const processados: string[] = []
    const sincronizar = vi.fn(async (id: string): Promise<ResultadoSincronizacaoGoogle> => {
      emExecucao += 1
      maximoEmExecucao = Math.max(maximoEmExecucao, emExecucao)
      processados.push(id)
      await Promise.resolve()
      emExecucao -= 1
      return { sincronizados: 1, removidos: id === 'b' ? 1 : 0, semConexao: 0, falhas: 0 }
    })

    const resultado = await sincronizarCartoesNoGoogle(['a', 'b', 'a', 'c'], 2, sincronizar)

    expect(processados.sort()).toEqual(['a', 'b', 'c'])
    expect(maximoEmExecucao).toBeLessThanOrEqual(2)
    expect(resultado).toEqual({ sincronizados: 3, removidos: 1, semConexao: 0, falhas: 0 })
  })

  it('isola a falha de um card e continua o restante do lote', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sincronizar = vi.fn(async (id: string): Promise<ResultadoSincronizacaoGoogle> => {
      if (id === 'falha') throw new Error('indisponível')
      return { sincronizados: 1, removidos: 0, semConexao: 0, falhas: 0 }
    })

    const resultado = await sincronizarCartoesNoGoogle(['ok-1', 'falha', 'ok-2'], 2, sincronizar)

    expect(resultado).toEqual({ sincronizados: 2, removidos: 0, semConexao: 0, falhas: 1 })
  })
})
