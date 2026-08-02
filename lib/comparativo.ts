/**
 * Comparação entre o período exibido e o imediatamente anterior de mesmo
 * tamanho.
 *
 * O painel já carrega 180 dias de indicadores em memória, então a janela
 * anterior sai da mesma lista — sem consulta nova. O preço é que ela nem sempre
 * cabe: comparar os últimos 180 dias exigiria 360, e o dado simplesmente não
 * está lá. Encarar isso é o ponto deste módulo — devolver um número calculado
 * sobre janela incompleta seria pior que não comparar, porque parece certo.
 */

export type Janela = { inicio: string; fim: string }

function paraUtc(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  )
}

function paraIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

const DIA = 86_400_000

/** Quantos dias a janela cobre, contando as duas pontas. */
export function tamanhoEmDias(janela: Janela): number {
  return Math.round((paraUtc(janela.fim) - paraUtc(janela.inicio)) / DIA) + 1
}

/**
 * A janela de mesmo tamanho que termina no dia anterior ao início desta.
 *
 * Períodos contíguos, sem sobreposição nem buraco: se o atual é 10–16, o
 * anterior é 3–9.
 */
export function janelaAnterior(atual: Janela): Janela {
  const dias = tamanhoEmDias(atual)
  const fim = paraUtc(atual.inicio) - DIA
  return { inicio: paraIso(fim - (dias - 1) * DIA), fim: paraIso(fim) }
}

/**
 * A janela anterior só é comparável se estiver inteira dentro do dado
 * carregado. Parcial produziria uma queda que é só falta de registro.
 */
export function comparavel(anterior: Janela, dadoDisponivelDesde: string): boolean {
  return paraUtc(anterior.inicio) >= paraUtc(dadoDisponivelDesde)
}

/**
 * Variação relativa entre dois valores, em fração (0.12 = +12%).
 *
 * `null` quando o valor anterior é zero: dividir por zero não dá infinito útil
 * na tela, e "subiu ∞%" não informa nada. A tela mostra "sem base de
 * comparação".
 */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return (atual - anterior) / anterior
}

/** Formata a variação como texto curto com sinal: `+12%`, `-4%`, `0%`. */
export function formatarVariacao(v: number | null): string | null {
  if (v === null) return null
  const pct = Math.round(v * 100)
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : ''}${pct}%`
}
