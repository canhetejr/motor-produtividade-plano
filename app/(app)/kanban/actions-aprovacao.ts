'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { dispararEvento } from '@/lib/automacoes'
import type { ActionResult } from '@/lib/action-result'
import type { TipoEvento } from '@/lib/automacoes-catalogo'
import type { Aprovacao } from './[quadroId]/types'

// Fluxo de aprovação por card — RPCs SECURITY DEFINER (mesmo padrão de
// aprovar_solicitacao) fazem status + notificação numa transação só. Ver
// supabase/migrations/20260729150000_kanban_aprovacoes.sql.

export async function listarAprovacoes(cartaoId: string): Promise<ActionResult<Aprovacao[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_aprovacoes')
    .select(
      'id, solicitado_por, aprovador_id, status, comentario, criado_em, solicitante:colaboradores!cartoes_aprovacoes_solicitado_por_fkey(nome), aprovador:colaboradores!cartoes_aprovacoes_aprovador_id_fkey(nome)'
    )
    .eq('cartao_id', cartaoId)
    .order('criado_em', { ascending: false })

  if (error) return { ok: false, error: 'Falha ao carregar as aprovações.' }

  const aprovacoes: Aprovacao[] = (data ?? []).map((a) => ({
    id: a.id,
    solicitadoPor: a.solicitado_por,
    solicitadoPorNome: (a.solicitante as unknown as { nome: string } | null)?.nome ?? null,
    aprovadorId: a.aprovador_id,
    aprovadorNome: (a.aprovador as unknown as { nome: string } | null)?.nome ?? null,
    status: a.status,
    comentario: a.comentario,
    criadoEm: a.criado_em,
  }))

  return { ok: true, data: aprovacoes }
}

// As três RPCs de decisão devolvem a aprovação; o cartao_id vem de lá pra não
// precisar de mais uma consulta só pra saber em que card disparar o evento.
async function dispararDeAprovacao(evento: TipoEvento, cartaoId: string, quadroId: string, atorId: string) {
  const supabase = await createClient()
  await dispararEvento({ supabase, evento, cartaoId, quadroId, atorId })
}

export async function solicitarAprovacao(cartaoId: string, aprovadorId: string, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.rpc('solicitar_aprovacao_cartao', {
    p_cartao_id: cartaoId,
    p_aprovador_id: aprovadorId,
  })
  if (error) {
    const mensagens: Record<string, string> = {
      NAO_AUTORIZADO: 'Você não tem acesso a este card.',
      APROVADOR_NAO_E_MEMBRO: 'O aprovador escolhido precisa ser membro deste quadro.',
    }
    return { ok: false, error: mensagens[error.message] ?? 'Falha ao solicitar aprovação.' }
  }

  await dispararDeAprovacao('aprovacao_solicitada', cartaoId, quadroId, user.id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function aprovarCartao(aprovacaoId: string, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('aprovar_cartao', { p_id: aprovacaoId })
  if (error) return { ok: false, error: 'Falha ao aprovar — a solicitação pode já ter sido decidida.' }

  const cartaoId = (data as { cartao_id?: string } | null)?.cartao_id
  if (cartaoId) await dispararDeAprovacao('cartao_aprovado', cartaoId, quadroId, user.id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function rejeitarCartao(aprovacaoId: string, comentario: string | null, quadroId: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('rejeitar_cartao', { p_id: aprovacaoId, p_comentario: comentario })
  if (error) return { ok: false, error: 'Falha ao rejeitar — a solicitação pode já ter sido decidida.' }

  const cartaoId = (data as { cartao_id?: string } | null)?.cartao_id
  if (cartaoId) await dispararDeAprovacao('cartao_reprovado', cartaoId, quadroId, user.id)

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
