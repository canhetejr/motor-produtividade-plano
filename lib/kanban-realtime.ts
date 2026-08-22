type ItemPosicionado = { id: string; posicao: number }

type ReconciliadorOpcoes<T> = {
  debounceMs: number
  carregar: () => Promise<T>
  aplicar: (snapshot: T) => void
  aoErro: (erro: unknown) => void
}

export function ordenarPorPosicao<T extends ItemPosicionado>(itens: readonly T[]): T[] {
  return itens.slice().sort((a, b) => a.posicao - b.posicao || a.id.localeCompare(b.id))
}

/** Reidrata cada item do snapshot sem descartar campos que só existem localmente. */
export function mesclarSnapshotPorId<Anterior extends { id: string }, Atual extends { id: string }, Resultado>(
  anteriores: readonly Anterior[],
  snapshot: readonly Atual[],
  mesclar: (atual: Atual, anterior: Anterior | undefined) => Resultado
): Resultado[] {
  const anterioresPorId = new Map(anteriores.map((item) => [item.id, item]))
  return snapshot.map((atual) => mesclar(atual, anterioresPorId.get(atual.id)))
}

/**
 * Coalesce eventos Realtime que representam uma mesma transação e aplica
 * somente a fotografia mais recente. O componente é responsável por cancelar
 * no cleanup do effect, então uma resposta de uma tela desmontada não escreve
 * em estado React já descartado.
 */
export function criarReconciliadorKanban<T>({ debounceMs, carregar, aplicar, aoErro }: ReconciliadorOpcoes<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let geracao = 0
  let descartado = false

  async function reconciliar(geracaoDaLeitura: number) {
    try {
      const snapshot = await carregar()
      if (!descartado && geracaoDaLeitura === geracao) aplicar(snapshot)
    } catch (erro) {
      if (!descartado && geracaoDaLeitura === geracao) aoErro(erro)
    }
  }

  return {
    notificar() {
      if (descartado) return
      geracao += 1
      if (timer) clearTimeout(timer)
      const geracaoDaLeitura = geracao
      timer = setTimeout(() => {
        timer = undefined
        void reconciliar(geracaoDaLeitura)
      }, debounceMs)
    },
    dispose() {
      descartado = true
      geracao += 1
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}
