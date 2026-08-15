import 'server-only'
import { randomUUID } from 'node:crypto'

/**
 * Normaliza a chave de idempotência que o cliente MCP pode ou não enviar.
 *
 * Quando o agente NÃO envia chave, cada chamada é uma chamada distinta — é o
 * comportamento honesto: sem chave não existe informação suficiente para
 * decidir se um segundo pedido é repetição ou uma ação nova de verdade
 * (registrar dois blocos da mesma demanda no mesmo dia é legítimo). Gerar um
 * UUID aqui mantém a linha de trilha em `mcp_escritas` para toda escrita, sem
 * fingir uma deduplicação que não foi pedida.
 */
export function chaveIdempotencia(informada: string | undefined): string {
  const limpa = informada?.trim()
  return limpa && limpa.length > 0 ? limpa : `auto-${randomUUID()}`
}
