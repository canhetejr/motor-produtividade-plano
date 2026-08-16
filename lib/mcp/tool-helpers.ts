import 'server-only'
import { ErroDeDominioMcp } from '@/lib/mcp/erros'
import { EscopoInsuficienteError } from '@/lib/mcp-auth'

export function textoJson(dado: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(dado, null, 2) }] }
}

export function erroFerramenta(mensagem: string) {
  return { content: [{ type: 'text' as const, text: mensagem }], isError: true as const }
}

/**
 * Por padrão troca a exceção pelo texto fixo do chamador: mensagem de erro do
 * Postgres carrega nome de tabela, coluna e às vezes valor de linha, e do
 * outro lado do Bearer token existe um agente que não é a pessoa.
 *
 * As duas exceções à regra são explícitas e ambas dizem ao agente algo que ele
 * precisa saber para se corrigir sozinho: falta de escopo (pedir um token com
 * a permissão certa) e regra de negócio (ErroDeDominioMcp — mesmo texto que a
 * UI mostraria ao colaborador).
 */
export function mensagemDeErro(err: unknown, fallback: string): string {
  if (err instanceof ErroDeDominioMcp) return err.message
  if (err instanceof EscopoInsuficienteError) return err.message
  return fallback
}
