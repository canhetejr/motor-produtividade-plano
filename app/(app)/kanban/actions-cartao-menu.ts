'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { traduzirRegraCartao } from '@/lib/kanban-regras'
import { clonarCartaoBase } from '@/lib/kanban-clone'
import { dispararEvento } from '@/lib/automacoes'
import type { ActionResult } from '@/lib/action-result'

// Ações do menu "..." do card: entregar/reabrir, reordenar, mover entre
// quadros, clonar, derivar um card novo, transferir responsabilidade pra uma
// área/equipe. "Apagar" já existe (excluirCartao em actions.ts).

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

// Atalho pro fluxo de entrega: leva o card pra primeira coluna marcada como
// `etapa_final` (entregar) ou pra primeira coluna do quadro (reabrir). Quem
// grava `entregue_em` é o trigger cartoes_aplicar_entrega — aqui só se decide
// o destino, pra que arrastar e clicar em "Entregar" tenham o mesmo efeito.
export async function alternarEntregaCartao(
  cartaoId: string,
  quadroId: string,
  entregar: boolean
): Promise<ActionResult<{ etapaDestino: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: colunas, error: colunasError } = await supabase
    .from('colunas')
    .select('id, nome, etapa_final')
    .eq('quadro_id', quadroId)
    .order('posicao')
  if (colunasError || !colunas || colunas.length === 0) {
    return { ok: false, error: 'Falha ao carregar as etapas do quadro.' }
  }

  const destino = entregar ? colunas.find((c) => c.etapa_final) : colunas.find((c) => !c.etapa_final)
  if (!destino) {
    return {
      ok: false,
      error: entregar
        ? 'Nenhuma etapa deste quadro está marcada como final. Marque uma no cabeçalho da coluna.'
        : 'Todas as etapas deste quadro são finais — não há para onde reabrir o card.',
    }
  }

  const { data: origem } = await supabase.from('cartoes').select('coluna_id').eq('id', cartaoId).single()
  if (origem?.coluna_id === destino.id) {
    return { ok: false, error: entregar ? 'Este card já está entregue.' : 'Este card já está em aberto.' }
  }

  const { count } = await supabase
    .from('cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', destino.id)

  const { error } = await supabase
    .from('cartoes')
    .update({ coluna_id: destino.id, posicao: count ?? 0 })
    .eq('id', cartaoId)
  if (error) {
    return {
      ok: false,
      error: traduzirRegraCartao(error) ?? (entregar ? 'Falha ao entregar o card.' : 'Falha ao reabrir o card.'),
    }
  }

  await supabase.from('comentarios_cartao').insert({
    cartao_id: cartaoId,
    colaborador_id: user.id,
    conteudo: entregar ? `Entregou o card em "${destino.nome}".` : `Reabriu o card em "${destino.nome}".`,
    tipo: 'sistema',
  })

  // Entregar é uma movimentação como outra qualquer para as automações.
  const { data: cartao } = await supabase.from('cartoes').select('cartao_pai_id').eq('id', cartaoId).single()
  const ehSubtarefa = !!cartao?.cartao_pai_id
  const base = { supabase, cartaoId, quadroId, atorId: user.id }

  if (origem?.coluna_id) {
    await dispararEvento({
      ...base,
      evento: ehSubtarefa ? 'subtarefa_saiu_etapa' : 'cartao_saiu_etapa',
      dados: { colunaId: origem.coluna_id },
    })
  }
  await dispararEvento({
    ...base,
    evento: ehSubtarefa ? 'subtarefa_entrou_etapa' : 'cartao_entrou_etapa',
    dados: { colunaId: destino.id },
  })
  if (ehSubtarefa && entregar) {
    await dispararEvento({ ...base, evento: 'subtarefa_entregue', dados: { colunaId: destino.id } })
  }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { etapaDestino: destino.nome } }
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
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data: colunaDestino, error: colunaError } = await supabase
    .from('colunas')
    .select('id, quadro_id')
    .eq('id', colunaDestinoId)
    .single()
  if (colunaError || !colunaDestino || colunaDestino.quadro_id !== quadroDestinoId) {
    return { ok: false, error: 'Coluna de destino inválida para o quadro escolhido.' }
  }

  const { data: origem } = await supabase.from('cartoes').select('coluna_id, cartao_pai_id').eq('id', cartaoId).single()

  const { count } = await supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('coluna_id', colunaDestinoId)

  const { error } = await supabase
    .from('cartoes')
    .update({ coluna_id: colunaDestinoId, posicao: count ?? 0 })
    .eq('id', cartaoId)
  if (error) {
    return { ok: false, error: traduzirRegraCartao(error) ?? 'Falha ao mover o card para o outro quadro.' }
  }

  // Mover entre quadros também é movimentação para as automações — era o
  // único caminho de mudança de coluna que não disparava evento nenhum.
  // "Saiu" dispara no quadro de origem; "entrou", no de destino.
  const ehSubtarefa = !!origem?.cartao_pai_id
  if (origem?.coluna_id) {
    await dispararEvento({
      supabase,
      evento: ehSubtarefa ? 'subtarefa_saiu_etapa' : 'cartao_saiu_etapa',
      cartaoId,
      quadroId: quadroOrigemId,
      atorId: user.id,
      dados: { colunaId: origem.coluna_id },
    })
  }
  await dispararEvento({
    supabase,
    evento: ehSubtarefa ? 'subtarefa_entrou_etapa' : 'cartao_entrou_etapa',
    cartaoId,
    quadroId: quadroDestinoId,
    atorId: user.id,
    dados: { colunaId: colunaDestinoId },
  })

  revalidatePath(`/kanban/${quadroOrigemId}`)
  revalidatePath(`/kanban/${quadroDestinoId}`)
  return { ok: true }
}

export async function clonarCartao(cartaoId: string, quadroId: string): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const resultado = await clonarCartaoBase(supabase, cartaoId, user.id, { prefixoTitulo: '(cópia) ' })
  if (!resultado.ok) return { ok: false, error: resultado.error }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true, data: { id: resultado.id } }
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
