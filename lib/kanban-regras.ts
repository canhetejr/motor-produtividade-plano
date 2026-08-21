import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'

// As regras de movimentação do card (pré-requisito entregue, requisito
// obrigatório da etapa, limite de WIP) vivem em trigger no banco — ver
// supabase/migrations/20260730100000_kanban_entrega_regras.sql. O motivo está
// lá: `cartoes.coluna_id` é alterado por quatro caminhos diferentes e a RLS
// permite update direto do browser, então validar na Server Action deixaria
// buracos.
//
// Desde 20260820213000 as próprias operações de mover/reordenar/criar são
// RPCs transacionais, e elas recusam com o mesmo vocabulário: `CODIGO` ou
// `CODIGO:detalhe`. Este módulo é o único lugar que traduz esse vocabulário
// para pt-BR — mesma ideia do mapa de mensagens em actions-aprovacao.ts, só
// que compartilhada porque moverCartao, criarCartao, reordenarColunas,
// atualizarCartao, moverCartaoDeQuadro e enviarParaTopo batem todos nas
// mesmas regras.

// `detalhe` é o texto depois dos dois-pontos. Nem toda regra usa: os códigos
// de autorização e de estado desatualizado carregam um detalhe técnico
// (`origem`, `destino`, `quadro`) que serve ao log, não à pessoa.
const MENSAGENS: Record<string, (detalhe: string) => string> = {
  PREREQUISITO_PENDENTE: (d) =>
    `Este card depende de ${d}, que ainda não foi entregue. Entregue o pré-requisito antes de mover.`,
  REQUISITO_OBRIGATORIO_PENDENTE: (d) =>
    `A etapa atual tem requisito obrigatório em aberto: ${d}. Marque na aba "Requisitos da etapa" antes de mover.`,
  WIP_EXCEDIDO: (d) => `A coluna de destino já atingiu o limite de ${d} cards em andamento.`,

  // --- Regras das RPCs transacionais (20260820213000) ---
  CARTAO_NAO_ENCONTRADO: () =>
    'Este card não existe mais ou você não tem acesso a ele. Atualize a página.',
  COLUNA_INVALIDA: () =>
    'A etapa escolhida não existe mais neste quadro. Atualize a página e tente de novo.',
  QUADRO_DIVERGENTE: () =>
    'A etapa de destino é de outro quadro. Use "Mover para outro quadro".',
  NAO_AUTORIZADO: () => 'Você não participa deste quadro.',
  NAO_AUTENTICADO: () => 'Sua sessão expirou. Entre de novo para continuar.',
  ORGANIZACAO_INATIVA: () => 'Sua conta ou a sua empresa está inativa.',
  ORDEM_INVALIDA: () =>
    'A ordem dos cards mudou enquanto você arrastava. Atualize a página e tente de novo.',
  COLUNAS_DESATUALIZADAS: () =>
    'As etapas deste quadro mudaram enquanto você arrastava. Atualize a página e tente de novo.',
  RESPONSAVEL_INVALIDO: () => 'Selecione apenas responsáveis ativos da sua empresa.',
  DEMANDA_INVALIDA: () => 'Selecione uma demanda ativa do catálogo da sua empresa.',
  CENTRO_INVALIDO: () => 'Selecione uma área válida da sua empresa.',
  TITULO_OBRIGATORIO: () => 'Informe o título do card.',
  DADOS_INVALIDOS: () => 'Não foi possível ler os dados do card. Atualize a página e tente de novo.',
}

// `CODIGO` seguido de `:` (com detalhe) ou de qualquer coisa que não seja
// letra/underscore (sem detalhe). O `\b` sozinho não bastava: `NAO_AUTORIZADO`
// casaria dentro de um código maior que terminasse igual.
const PADRAO = new RegExp(`(?<![A-Z_])(${Object.keys(MENSAGENS).join('|')})(?![A-Z_])(?::([^\\n]*))?`)

/**
 * Devolve a mensagem pt-BR quando o erro veio de uma das regras do banco, ou
 * `null` quando é outra falha qualquer (que o chamador trata como sempre).
 */
export function traduzirRegraCartao(error: PostgrestError | null): string | null {
  if (!error?.message) return null

  const encontrado = PADRAO.exec(error.message)
  if (!encontrado) return null

  const [, codigo, detalhe] = encontrado
  return MENSAGENS[codigo](detalhe?.trim() ?? '')
}
