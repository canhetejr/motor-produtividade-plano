'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'

// Ações do menu "..." do card: reordenar, mover entre quadros, clonar,
// derivar um card novo, transferir responsabilidade pra uma área/equipe.
// "Apagar" já existe (excluirCartao em actions.ts).

export async function listarQuadrosDisponiveis(quadroAtualId: string): Promise<ActionResult<{ id: string; nome: string; colunas: { id: string; nome: string }[] }[]>> {
  await requireUser()
  const supabase = await createClient()

  // RLS (quadros_select_membro) já filtra pra só gestor/membro — não precisa
  // repetir a checagem aqui.
  const { data, error } = await supabase
    .from('quadros')
    .select('id, nome, colunas(id, nome)')
    .neq('id', quadroAtualId)
    .eq('ativo', true)
    .order('nome')
  if (error) return { ok: false, error: 'Falha ao carregar os quadros disponíveis.' }

  return {
    ok: true,
    data: (data ?? []).map((q) => ({
      id: q.id,
      nome: q.nome,
      colunas: (q.colunas as unknown as { id: string; nome: string }[]) ?? [],
    })),
  }
}

export async function enviarParaTopo(cartaoId: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { data: cartao, error: cartaoError } = await supabase.from('cartoes').select('coluna_id').eq('id', cartaoId).single()
  if (cartaoError || !cartao) return { ok: false, error: 'Card não encontrado.' }

  const { data: outros, error: outrosError } = await supabase
    .from('cartoes')
    .select('id')
    .eq('coluna_id', cartao.coluna_id)
    .neq('id', cartaoId)
    .order('posicao')
  if (outrosError) return { ok: false, error: 'Falha ao reordenar o card.' }

  await supabase.from('cartoes').update({ posicao: 0 }).eq('id', cartaoId)
  await Promise.all((outros ?? []).map((c, index) => supabase.from('cartoes').update({ posicao: index + 1 }).eq('id', c.id)))

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function moverCartaoDeQuadro(cartaoId: string, quadroOrigemId: string, quadroDestinoId: string, colunaDestinoId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { data: colunaDestino, error: colunaError } = await supabase
    .from('colunas')
    .select('id, quadro_id')
    .eq('id', colunaDestinoId)
    .single()
  if (colunaError || !colunaDestino || colunaDestino.quadro_id !== quadroDestinoId) {
    return { ok: false, error: 'Coluna de destino inválida para o quadro escolhido.' }
  }

  const { count } = await supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('coluna_id', colunaDestinoId)

  const { error } = await supabase
    .from('cartoes')
    .update({ coluna_id: colunaDestinoId, posicao: count ?? 0 })
    .eq('id', cartaoId)
  if (error) return { ok: false, error: 'Falha ao mover o card para o outro quadro.' }

  revalidatePath(`/kanban/${quadroOrigemId}`)
  revalidatePath(`/kanban/${quadroDestinoId}`)
  return { ok: true }
}

export async function clonarCartao(cartaoId: string, quadroId: string): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: original, error: fetchError } = await supabase
    .from('cartoes')
    .select('*, cartoes_responsaveis(colaborador_id), cartoes_etiquetas(etiqueta_id)')
    .eq('id', cartaoId)
    .single()
  if (fetchError || !original) return { ok: false, error: 'Card não encontrado.' }

  const { count } = await supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('coluna_id', original.coluna_id)

  const { data: clone, error } = await supabase
    .from('cartoes')
    .insert({
      coluna_id: original.coluna_id,
      titulo: `(cópia) ${original.titulo}`,
      descricao: original.descricao,
      prioridade: original.prioridade,
      prazo: original.prazo,
      tipo: original.tipo,
      tempo_estimado_min: original.tempo_estimado_min,
      centro_id: original.centro_id,
      tag_referencia: original.tag_referencia,
      posicao: count ?? 0,
      criado_por: user.id,
    })
    .select('id')
    .single()
  if (error || !clone) return { ok: false, error: 'Falha ao clonar o card.' }

  const responsaveis = (original.cartoes_responsaveis ?? []).map((r: { colaborador_id: string }) => r.colaborador_id)
  const etiquetas = (original.cartoes_etiquetas ?? []).map((e: { etiqueta_id: string }) => e.etiqueta_id)
  if (responsaveis.length > 0) {
    await supabase.from('cartoes_responsaveis').insert(responsaveis.map((colaborador_id: string) => ({ cartao_id: clone.id, colaborador_id })))
  }
  if (etiquetas.length > 0) {
    await supabase.from('cartoes_etiquetas').insert(etiquetas.map((etiqueta_id: string) => ({ cartao_id: clone.id, etiqueta_id })))
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { id: clone.id } }
}

// Diferente de clonar: só aproveita título/descrição como ponto de partida,
// sem levar responsáveis/etiquetas/estimativas — é "um card novo inspirado
// nesse", não uma cópia fiel.
export async function criarTarefaAPartirDe(cartaoId: string, colunaDestinoId: string, quadroId: string): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: original, error: fetchError } = await supabase.from('cartoes').select('titulo, descricao').eq('id', cartaoId).single()
  if (fetchError || !original) return { ok: false, error: 'Card não encontrado.' }

  const { count } = await supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('coluna_id', colunaDestinoId)

  const { data: novo, error } = await supabase
    .from('cartoes')
    .insert({
      coluna_id: colunaDestinoId,
      titulo: original.titulo,
      descricao: original.descricao,
      posicao: count ?? 0,
      criado_por: user.id,
    })
    .select('id')
    .single()
  if (error || !novo) return { ok: false, error: 'Falha ao criar o card.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { id: novo.id } }
}

// "Transferir para equipe": reatribui a responsabilidade do card a todos os
// colaboradores ativos de uma área — substitui os responsáveis atuais, não
// soma (é uma transferência, não um convite extra).
export async function transferirParaEquipe(cartaoId: string, areaId: string, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: colaboradoresArea, error: areaError } = await supabase
    .from('colaboradores')
    .select('id')
    .eq('area_id', areaId)
    .eq('ativo', true)
  if (areaError) return { ok: false, error: 'Falha ao carregar os colaboradores da área.' }
  if (!colaboradoresArea || colaboradoresArea.length === 0) {
    return { ok: false, error: 'Essa área não tem colaboradores ativos vinculados.' }
  }

  await supabase.from('cartoes_responsaveis').delete().eq('cartao_id', cartaoId)
  const { error } = await supabase
    .from('cartoes_responsaveis')
    .insert(colaboradoresArea.map((c) => ({ cartao_id: cartaoId, colaborador_id: c.id })))
  if (error) return { ok: false, error: 'Falha ao transferir o card para a equipe.' }

  const { data: area } = await supabase.from('areas').select('nome').eq('id', areaId).single()
  await supabase.from('comentarios_cartao').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    conteudo: `Transferiu o card para a equipe "${area?.nome ?? '—'}".`,
    tipo: 'sistema',
  })

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
