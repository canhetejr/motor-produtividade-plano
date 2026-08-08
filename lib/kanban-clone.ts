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
  organizacaoId: string,
  opcoes: Opcoes = {}
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: original, error: fetchError } = await supabase
    .from('cartoes')
    .select('*, demandas(area_id), cartoes_responsaveis(colaborador_id, colaboradores(area_id, ativo)), cartoes_etiquetas(etiqueta_id)')
    .eq('id', cartaoId)
    .single()
  if (fetchError || !original) return { ok: false, error: 'Card não encontrado.' }

  const colunaDestinoId = opcoes.colunaDestinoId ?? original.coluna_id
  const demandaAreaId = (original.demandas as unknown as { area_id: string } | null)?.area_id
  const responsaveisDetalhados = (original.cartoes_responsaveis ?? []) as unknown as Array<{
    colaborador_id: string
    colaboradores: { area_id: string | null; ativo: boolean } | null
  }>
  const responsaveisAtivos = responsaveisDetalhados.filter((responsavel) => responsavel.colaboradores?.ativo)
  const responsaveis = responsaveisAtivos
    .map((responsavel) => responsavel.colaborador_id)
  const demandaValida = Boolean(
    original.demanda_id
    && demandaAreaId
    && responsaveis.length > 0
    && responsaveisAtivos.every((responsavel) => responsavel.colaboradores?.area_id === demandaAreaId)
  )

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaDestinoId)

  const { data: clone, error } = await supabase
    .from('cartoes')
    .insert({
      // `codigo` é sobrescrito pelo trigger tr_gerar_codigo_cartao (before
      // insert) — o valor aqui nunca chega a ser persistido.
      codigo: '',
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
      demanda_id: demandaValida ? original.demanda_id : null,
      tag_referencia: original.tag_referencia,
      recorrencia: opcoes.manterRecorrencia ? original.recorrencia : null,
      posicao: count ?? 0,
      criado_por: criadoPor,
      organizacao_id: organizacaoId,
    })
    .select('id')
    .single()
  if (error || !clone) return { ok: false, error: 'Falha ao clonar o card.' }

  const etiquetas = (original.cartoes_etiquetas ?? []).map((e: { etiqueta_id: string }) => e.etiqueta_id)

  if (responsaveis.length > 0) {
    const { error: responsaveisError } = await supabase
      .from('cartoes_responsaveis')
      .insert(responsaveis.map((colaborador_id: string) => ({ cartao_id: clone.id, colaborador_id })))
    if (responsaveisError) {
      await supabase.from('cartoes').delete().eq('id', clone.id)
      return { ok: false, error: 'Falha ao copiar os responsáveis do card.' }
    }
  }
  if (etiquetas.length > 0) {
    const { error: etiquetasError } = await supabase
      .from('cartoes_etiquetas')
      .insert(etiquetas.map((etiqueta_id: string) => ({ cartao_id: clone.id, etiqueta_id })))
    if (etiquetasError) {
      await supabase.from('cartoes').delete().eq('id', clone.id)
      return { ok: false, error: 'Falha ao copiar as etiquetas do card.' }
    }
  }

  return { ok: true, id: clone.id }
}
