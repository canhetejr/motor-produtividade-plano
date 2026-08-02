/**
 * Escape dos curingas do operador `like` do PostgREST.
 *
 * Mora em lib/ separado da action para ter teste: é uma função de segurança
 * discreta — sem ela um `%` digitado casa com tudo, um `_` casa com qualquer
 * caractere e uma vírgula quebra a expressão `or(...)` do PostgREST, que usa
 * vírgula como separador de condições.
 */
export function escaparTermoBusca(termo: string): string {
  return termo.replace(/[\\%_,()]/g, '\\$&')
}
