import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'

// As regras de movimentação do card (pré-requisito entregue, requisito
// obrigatório da etapa, limite de WIP) vivem em trigger no banco — ver
// supabase/migrations/20260730100000_kanban_entrega_regras.sql. O motivo está
// lá: `cartoes.coluna_id` é alterado por quatro caminhos diferentes e a RLS
// permite update direto do browser, então validar na Server Action deixaria
// buracos.
//
// O custo disso é que a violação chega como exceção do Postgres. Este módulo
// traduz `CODIGO:detalhe` na mensagem pt-BR que a UI mostra — mesma ideia do
// mapa de mensagens em actions-aprovacao.ts, só que compartilhada porque
// moverCartao, atualizarCartao, moverCartaoDeQuadro e enviarParaTopo batem
// todas no mesmo trigger.

const MENSAGENS: Record<string, (detalhe: string) => string> = {
  PREREQUISITO_PENDENTE: (d) =>
    `Este card depende de ${d}, que ainda não foi entregue. Entregue o pré-requisito antes de mover.`,
  REQUISITO_OBRIGATORIO_PENDENTE: (d) =>
    `A etapa atual tem requisito obrigatório em aberto: ${d}. Marque na aba "Requisitos da etapa" antes de mover.`,
  WIP_EXCEDIDO: (d) => `A coluna de destino já atingiu o limite de ${d} cards em andamento.`,
}

/**
 * Devolve a mensagem pt-BR quando o erro veio de uma das regras do trigger,
 * ou `null` quando é outra falha qualquer (que o chamador trata como sempre).
 */
export function traduzirRegraCartao(error: PostgrestError | null): string | null {
  if (!error?.message) return null

  for (const [codigo, montar] of Object.entries(MENSAGENS)) {
    const marcador = `${codigo}:`
    const inicio = error.message.indexOf(marcador)
    if (inicio === -1) continue
    // A mensagem do Postgres pode vir prefixada ("... raise exception ..."),
    // então corta a partir do marcador e limpa o que o driver anexar depois.
    const detalhe = error.message.slice(inicio + marcador.length).split('\n')[0].trim()
    return montar(detalhe)
  }

  return null
}
