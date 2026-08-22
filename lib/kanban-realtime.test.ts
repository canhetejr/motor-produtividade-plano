import { describe, expect, it, vi } from 'vitest'
import { criarReconciliadorKanban, ordenarPorPosicao } from './kanban-realtime'

describe('ordenarPorPosicao', () => {
  it('ordena por posição e desempata por id sem mutar a lista original', () => {
    const original = [
      { id: 'b', posicao: 1 },
      { id: 'c', posicao: 0 },
      { id: 'a', posicao: 1 },
    ]

    expect(ordenarPorPosicao(original).map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(original.map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('mesclarSnapshotPorId', () => {
  it('reidrata campos autoritativos sem perder metadados locais derivados', async () => {
    const { mesclarSnapshotPorId } = await import('./kanban-realtime')
    const anterior = [{ id: 'card-1', posicao: 2, titulo: 'Antes', totalAnexos: 4 }]
    const snapshot = [{ id: 'card-1', posicao: 0, titulo: 'Depois' }, { id: 'card-2', posicao: 1, titulo: 'Novo' }]

    expect(mesclarSnapshotPorId(anterior, snapshot, (atual, existente) => ({
      ...atual,
      totalAnexos: existente?.totalAnexos ?? 0,
    }))).toEqual([
      { id: 'card-1', posicao: 0, titulo: 'Depois', totalAnexos: 4 },
      { id: 'card-2', posicao: 1, titulo: 'Novo', totalAnexos: 0 },
    ])
  })
})

describe('criarReconciliadorKanban', () => {
  it('coalesce eventos próximos em uma única reconciliação', async () => {
    vi.useFakeTimers()
    const carregar = vi.fn(async () => 'snapshot')
    const aplicar = vi.fn()
    const reconciliador = criarReconciliadorKanban({ debounceMs: 100, carregar, aplicar, aoErro: vi.fn() })

    reconciliador.notificar()
    reconciliador.notificar()
    reconciliador.notificar()
    await vi.advanceTimersByTimeAsync(100)

    expect(carregar).toHaveBeenCalledTimes(1)
    expect(aplicar).toHaveBeenCalledWith('snapshot')
    reconciliador.dispose()
    vi.useRealTimers()
  })

  it('descarta a resposta antiga se houver uma geração mais nova pendente', async () => {
    vi.useFakeTimers()
    let resolverPrimeira: ((value: string) => void) | undefined
    const carregar = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => new Promise((resolve) => { resolverPrimeira = resolve }))
      .mockResolvedValueOnce('novo')
    const aplicar = vi.fn()
    const reconciliador = criarReconciliadorKanban({ debounceMs: 10, carregar, aplicar, aoErro: vi.fn() })

    reconciliador.notificar()
    await vi.advanceTimersByTimeAsync(10)
    reconciliador.notificar()
    resolverPrimeira?.('antigo')
    await vi.advanceTimersByTimeAsync(10)
    await Promise.resolve()

    expect(aplicar).toHaveBeenCalledTimes(1)
    expect(aplicar).toHaveBeenCalledWith('novo')
    reconciliador.dispose()
    vi.useRealTimers()
  })

  it('não aplica respostas nem mantém timers depois do dispose', async () => {
    vi.useFakeTimers()
    const carregar = vi.fn(async () => 'snapshot')
    const aplicar = vi.fn()
    const reconciliador = criarReconciliadorKanban({ debounceMs: 10, carregar, aplicar, aoErro: vi.fn() })

    reconciliador.notificar()
    reconciliador.dispose()
    await vi.advanceTimersByTimeAsync(10)

    expect(carregar).not.toHaveBeenCalled()
    expect(aplicar).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
