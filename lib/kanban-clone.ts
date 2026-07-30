import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Clonar um card é usado por dois chamadores com clients diferentes: o menu
// "..." (client da sessão do usuário) e o cron de recorrência (client admin,
// sem sessão). Por isso o client e o autor vêm por parâmetro em vez de serem
// resolvidos aqui dentro.

type Opcoes = {
  /** Coluna de destino. Padrão: a mesma do original. */
  colunaDestinoId?: string
  /** Prefixo no título — o menu usa "(cópia) ", a recorrência não usa nada. */
  prefixoTitulo?: string
  /** Recorrência é herdada só quando o clone deve continuar se repetindo. */
  manterRecorrencia?: boolean
}

export async function clonarCartaoBase(
  supabase: SupabaseClient<Database>,
  cartaoId: string,
  criadoPor: string | null,
  opcoes: Opcoes = {}
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: original, error: fetchError } = await supabase
    .from('cartoes')
    .select('*, cartoes_responsaveis(colaborador_id), cartoes_etiquetas(etiqueta_id)')
    .eq('id', cartaoId)
    .single()
  if (fetchError || !original) return { ok: false, error: 'Card não encontrado.' }

  const colunaDestinoId = opcoes.colunaDestinoId ?? original.coluna_id

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaDestinoId)

  const { data: clone, error } = await supabase
    .from('cartoes')
    .insert({
      coluna_id: colunaDestinoId,
      titulo: `${opcoes.prefixoTitulo ?? ''}${original.titulo}`,
      descricao: original.descricao,
      prioridade: original.prioridade,
      prazo: original.prazo,
      tipo: original.tipo,
      tempo_estimado_min: original.tempo_estimado_min,
      centro_id: original.centro_id,
      // Sem herdar a demanda, o clone da recorrência para de alimentar o
      // índice de produtividade — e ninguém percebe até o relatório não bater.
      demanda_id: original.demanda_id,
      tag_referencia: original.tag_referencia,
      recorrencia: opcoes.manterRecorrencia ? original.recorrencia : null,
      posicao: count ?? 0,
      criado_por: criadoPor,
    })
    .select('id')
    .single()
  if (error || !clone) return { ok: false, error: 'Falha ao clonar o card.' }

  const responsaveis = (original.cartoes_responsaveis ?? []).map((r: { colaborador_id: string }) => r.colaborador_id)
  const etiquetas = (original.cartoes_etiquetas ?? []).map((e: { etiqueta_id: string }) => e.etiqueta_id)

  if (responsaveis.length > 0) {
    await supabase
      .from('cartoes_responsaveis')
      .insert(responsaveis.map((colaborador_id: string) => ({ cartao_id: clone.id, colaborador_id })))
  }
  if (etiquetas.length > 0) {
    await supabase
      .from('cartoes_etiquetas')
      .insert(etiquetas.map((etiqueta_id: string) => ({ cartao_id: clone.id, etiqueta_id })))
  }

  return { ok: true, id: clone.id }
}
