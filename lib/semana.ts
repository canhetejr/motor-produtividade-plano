/**
 * Agrupamento por proximidade de prazo, para a rota /minha-semana.
 *
 * A lógica vive aqui, e não na página, porque é regra de calendário — o tipo de
 * coisa que erra em virada de mês, ano e horário de verão, e que precisa de
 * teste. A página só desenha.
 */

export type CartaoComPrazo = {
  id: string
  prazo: string
}

export type ChaveFaixa = 'atrasado' | 'hoje' | 'amanha' | 'esta_semana' | 'depois'

export const ROTULOS: Record<ChaveFaixa, string> = {
  atrasado: 'Atrasado',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  esta_semana: 'Próximos 7 dias',
  depois: 'Mais adiante',
}

export const ORDEM: ChaveFaixa[] = ['atrasado', 'hoje', 'amanha', 'esta_semana', 'depois']

/**
 * Diferença em dias entre duas datas `YYYY-MM-DD`.
 *
 * Comparação feita em UTC de propósito: `new Date('2026-08-10')` já é
 * interpretado como meia-noite UTC, e misturar com horário local produziria
 * diferença de um dia dependendo do fuso — no Brasil, sempre para trás.
 */
export function diasAte(prazo: string, hoje: string): number {
  const a = Date.UTC(
    Number(prazo.slice(0, 4)),
    Number(prazo.slice(5, 7)) - 1,
    Number(prazo.slice(8, 10))
  )
  const b = Date.UTC(
    Number(hoje.slice(0, 4)),
    Number(hoje.slice(5, 7)) - 1,
    Number(hoje.slice(8, 10))
  )
  return Math.round((a - b) / 86_400_000)
}

export function faixaDe(prazo: string, hoje: string): ChaveFaixa {
  const dias = diasAte(prazo, hoje)
  if (dias < 0) return 'atrasado'
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanha'
  if (dias <= 7) return 'esta_semana'
  return 'depois'
}

/** `YYYY-MM-DD` do dia corrente no fuso de São Paulo, que é o do time. */
export function hojeEmSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

export function agruparPorFaixa<T extends CartaoComPrazo>(
  cartoes: T[],
  hoje = hojeEmSaoPaulo()
): Array<{ chave: ChaveFaixa; rotulo: string; cartoes: T[] }> {
  const mapa = new Map<ChaveFaixa, T[]>()
  for (const c of cartoes) {
    const chave = faixaDe(c.prazo, hoje)
    const atual = mapa.get(chave)
    if (atual) atual.push(c)
    else mapa.set(chave, [c])
  }
  // Faixa vazia não vira seção: um "Amanhã" sem nada dentro é ruído.
  return ORDEM.filter((chave) => mapa.has(chave)).map((chave) => ({
    chave,
    rotulo: ROTULOS[chave],
    cartoes: mapa.get(chave)!,
  }))
}
