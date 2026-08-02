/**
 * Cronômetro do apontamento de demanda variável.
 *
 * A lógica de tempo vive aqui, e não no componente, porque o estado precisa
 * sobreviver a fechar a aba: o que se guarda é o instante de início, não o
 * contador. Guardar o contador significaria perder o tempo decorrido enquanto a
 * página esteve fechada — e num app usado no celular, a aba fecha o tempo todo.
 */

export type EstadoCronometro = {
  /** Epoch em ms de quando a contagem retomou pela última vez. */
  iniciadoEm: number | null
  /** Segundos já acumulados em trechos anteriores (antes de pausar). */
  acumulado: number
}

export const PARADO: EstadoCronometro = { iniciadoEm: null, acumulado: 0 }

/**
 * Segundos decorridos.
 *
 * `agora` entra como parâmetro para o cálculo ser testável sem esperar o tempo
 * passar.
 */
export function decorrido(estado: EstadoCronometro, agora: number): number {
  if (estado.iniciadoEm === null) return estado.acumulado
  // Math.max contra relógio que andou para trás: ajuste de fuso, NTP ou o
  // usuário mexendo na data produziriam tempo negativo.
  const emAndamento = Math.max(0, Math.floor((agora - estado.iniciadoEm) / 1000))
  return estado.acumulado + emAndamento
}

export function iniciar(estado: EstadoCronometro, agora: number): EstadoCronometro {
  if (estado.iniciadoEm !== null) return estado
  return { iniciadoEm: agora, acumulado: estado.acumulado }
}

export function pausar(estado: EstadoCronometro, agora: number): EstadoCronometro {
  if (estado.iniciadoEm === null) return estado
  return { iniciadoEm: null, acumulado: decorrido(estado, agora) }
}

export function zerar(): EstadoCronometro {
  return PARADO
}

export function estaRodando(estado: EstadoCronometro): boolean {
  return estado.iniciadoEm !== null
}

/** `HH:MM:SS` para o mostrador. */
export function formatarRelogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  return [h, m, seg].map((n) => String(n).padStart(2, '0')).join(':')
}

/**
 * Minutos para preencher o campo do formulário.
 *
 * Arredonda para cima a partir de 30 segundos, e nunca devolve zero quando
 * houve alguma contagem: registrar "0 min" de trabalho feito seria pior que
 * registrar 1.
 */
export function paraMinutos(segundos: number): number {
  if (segundos <= 0) return 0
  return Math.max(1, Math.round(segundos / 60))
}

/** Valida o que veio do armazenamento — pode ter sido corrompido ou editado. */
export function lerEstado(bruto: string | null): EstadoCronometro {
  if (!bruto) return PARADO
  try {
    const d = JSON.parse(bruto)
    if (typeof d !== 'object' || d === null) return PARADO
    const acumulado = typeof d.acumulado === 'number' && d.acumulado >= 0 ? d.acumulado : 0
    const iniciadoEm =
      typeof d.iniciadoEm === 'number' && d.iniciadoEm > 0 ? d.iniciadoEm : null
    return { iniciadoEm, acumulado }
  } catch {
    return PARADO
  }
}
