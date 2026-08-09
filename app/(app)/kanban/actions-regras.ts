'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { Predecessor, SequenciaResponsavel } from './[quadroId]/types'

// Aba "Regras": dependências (pré-requisito/subsequente, mesma tabela lida
// nos dois sentidos) e sequência de responsáveis (fila ordenada, avança via
// RPC avancar_sequencia_cartao — ver
// supabase/migrations/20260729130000_kanban_regras_dependencias.sql).

export async function listarPredecessores(cartaoId: string): Promise<ActionResult<Predecessor[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_predecessores')
    .select('cartoes!cartoes_predecessores_predecessor_id_fkey(id, titulo, codigo, entregue_em)')
    .eq('cartao_id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao carregar os pré-requisitos.' }

  const predecessores: Predecessor[] = (data ?? [])
    .map((row) => row.cartoes as unknown as { id: string; titulo: string; codigo: string; entregue_em: string | null } | null)
    .filter((c): c is { id: string; titulo: string; codigo: string; entregue_em: string | null } => !!c)
    .map((c) => ({ id: c.id, titulo: c.titulo, codigo: c.codigo, entregue: !!c.entregue_em }))

  return { ok: true, data: predecessores }
}

export async function listarSubsequentes(cartaoId: string): Promise<ActionResult<Predecessor[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_predecessores')
    .select('cartoes!cartoes_predecessores_cartao_id_fkey(id, titulo, codigo, entregue_em)')
    .eq('predecessor_id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao carregar os subsequentes.' }

  const subsequentes: Predecessor[] = (data ?? [])
    .map((row) => row.cartoes as unknown as { id: string; titulo: string; codigo: string; entregue_em: string | null } | null)
    .filter((c): c is { id: string; titulo: string; codigo: string; entregue_em: string | null } => !!c)
    .map((c) => ({ id: c.id, titulo: c.titulo, codigo: c.codigo, entregue: !!c.entregue_em }))

  return { ok: true, data: subsequentes }
}

export async function buscarCartaoPorCodigo(quadroId: string, codigo: string): Promise<ActionResult<{ id: string; titulo: string }>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes')
    .select('id, titulo, colunas!inner(quadro_id)')
    .eq('codigo', codigo.trim().toUpperCase())
    .eq('colunas.quadro_id', quadroId)
    .maybeSingle()
  if (error || !data) return { ok: false, error: 'Card não encontrado neste quadro.' }

  return { ok: true, data: { id: data.id, titulo: data.titulo } }
}

export async function vincularPredecessor(cartaoId: string, predecessorId: string, quadroId: string): Promise<ActionResult> {
  const { profile } = await requireUser()
  const supabase = await createClient()

  if (cartaoId === predecessorId) return { ok: false, error: 'Um card não pode depender de si mesmo.' }

  const { error } = await supabase.from('cartoes_predecessores').insert({ cartao_id: cartaoId, predecessor_id: predecessorId, organizacao_id: profile.organizacao_id })
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Essa dependência já existe.' : 'Falha ao vincular o pré-requisito.',
    }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function desvincularPredecessor(cartaoId: string, predecessorId: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('cartoes_predecessores')
    .delete()
    .eq('cartao_id', cartaoId)
    .eq('predecessor_id', predecessorId)
  if (error) return { ok: false, error: 'Falha ao remover a dependência.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function listarSequenciaResponsaveis(cartaoId: string): Promise<ActionResult<SequenciaResponsavel[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_sequencia_responsaveis')
    .select('id, colaborador_id, ordem, entregue, colaboradores(nome)')
    .eq('cartao_id', cartaoId)
    .order('ordem')
  if (error) return { ok: false, error: 'Falha ao carregar a sequência de responsáveis.' }

  const sequencia: SequenciaResponsavel[] = (data ?? []).map((s) => ({
    id: s.id,
    colaboradorId: s.colaborador_id,
    colaboradorNome: (s.colaboradores as unknown as { nome: string } | null)?.nome ?? '—',
    ordem: s.ordem,
    entregue: s.entregue,
  }))

  return { ok: true, data: sequencia }
}

// Substitui a sequência inteira de uma vez (mesmo padrão de
// atualizarMembrosQuadro: apaga tudo e reinsere na ordem recebida).
export async function definirSequenciaResponsaveis(cartaoId: string, quadroId: string, colaboradorIds: string[]): Promise<ActionResult> {
  const { profile } = await requireUser()
  const supabase = await createClient()

  const { error: deleteError } = await supabase.from('cartoes_sequencia_responsaveis').delete().eq('cartao_id', cartaoId)
  if (deleteError) return { ok: false, error: 'Falha ao definir a sequência.' }

  if (colaboradorIds.length > 0) {
    const { error } = await supabase.from('cartoes_sequencia_responsaveis').insert(
      colaboradorIds.map((colaborador_id, index) => ({ cartao_id: cartaoId, colaborador_id, ordem: index, organizacao_id: profile.organizacao_id }))
    )
    if (error) return { ok: false, error: 'Falha ao definir a sequência.' }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function avancarSequencia(cartaoId: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.rpc('avancar_sequencia_cartao', { p_cartao_id: cartaoId })
  if (error) {
    const mensagens: Record<string, string> = {
      NAO_AUTORIZADO: 'Você não tem acesso a este card.',
      SEQUENCIA_SEM_PENDENTES: 'Não há mais ninguém pendente na sequência.',
    }
    return { ok: false, error: mensagens[error.message] ?? 'Falha ao avançar a sequência.' }
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
