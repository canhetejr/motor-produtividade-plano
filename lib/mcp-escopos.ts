// Vocabulário de escopos MCP, SEM 'server-only' de propósito.
//
// lib/mcp-auth.ts é server-only (importa o client de service role). A tela de
// tokens em app/(app)/perfil/mcp-tokens-manager.tsx é um componente de
// cliente e precisa dos mesmos rótulos e da mesma pergunta "isto é escrita?".
// Importar de lá um VALOR (e não só um `type`, que some na compilação)
// arrastava utils/supabase/admin para o bundle do navegador e quebrava o
// build — motivo pelo qual esta lista mora aqui e não lá.
//
// Estes valores também precisam concordar com mcp_escopos_validos() no banco
// (supabase/migrations/20260815140000_mcp_escrita.sql): é a constraint que
// barra um escopo inventado chegando a mcp_tokens por qualquer outro caminho.

export type EscopoMcp =
  | 'apontamento:leitura'
  | 'apontamento:escrita'
  | 'kanban:leitura'
  | 'kanban:escrita'

export const ESCOPOS_MCP_DISPONIVEIS: EscopoMcp[] = [
  'apontamento:leitura',
  'apontamento:escrita',
  'kanban:leitura',
  'kanban:escrita',
]

// Leitura e escrita são escopos separados de propósito: um token de leitura
// existente NUNCA ganha poder de escrita por atualização de servidor — para
// escrever, é preciso emitir um token novo com o escopo explícito.
export const ESCOPOS_MCP_ESCRITA: EscopoMcp[] = ['apontamento:escrita', 'kanban:escrita']

export function ehEscopoDeEscrita(escopo: string): boolean {
  return (ESCOPOS_MCP_ESCRITA as string[]).includes(escopo)
}
