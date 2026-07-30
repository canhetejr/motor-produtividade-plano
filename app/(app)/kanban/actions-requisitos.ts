'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor, requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { Requisito } from './[quadroId]/types'

const descricaoSchema = z.string().trim().min(1, 'Informe a descrição do requisito').max(300, 'Descrição muito longa (máx. 300 caracteres)')

// "Requisitos da etapa": presos à COLUNA (etapa) — todo card que passa por
// ali vê a mesma lista e marca individualmente o que já cumpriu.

export async function listarRequisitosDaEtapa(cartaoId: string, colunaId: string): Promise<ActionResult<Requisito[]>> {
  await requireUser()
  const supabase = await createClient()

  const [{ data: requisitos, error: requisitosError }, { data: status, error: statusError }] = await Promise.all([
    supabase.from('colunas_requisitos').select('id, descricao, obrigatorio').eq('coluna_id', colunaId).order('posicao'),
    supabase.from('cartoes_requisitos_status').select('requisito_id, concluido').eq('cartao_id', cartaoId),
  ])
  if (requisitosError || statusError) return { ok: false, error: 'Falha ao carregar os requisitos da etapa.' }

  const statusMap = new Map((status ?? []).map((s) => [s.requisito_id, s.concluido]))
  const resultado: Requisito[] = (requisitos ?? []).map((r) => ({
    id: r.id,
    descricao: r.descricao,
    obrigatorio: r.obrigatorio,
    concluido: statusMap.get(r.id) ?? false,
  }))

  return { ok: true, data: resultado }
}

// Mexer nos requisitos muda a regra pra todos os cards que passam pela etapa
// (o trigger cartoes_validar_saida_etapa lê essa tabela), então é coisa de
// gestor — diferente de marcar um requisito, que qualquer membro faz.
export async function criarRequisitoEtapa(
  colunaId: string,
  quadroId: string,
  descricao: string,
  obrigatorio = true
): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = descricaoSchema.safeParse(descricao)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { count } = await supabase
    .from('colunas_requisitos')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', colunaId)

  const { error } = await supabase
    .from('colunas_requisitos')
    .insert({ coluna_id: colunaId, descricao: parsed.data, obrigatorio, posicao: count ?? 0 })
  if (error) return { ok: false, error: 'Falha ao criar o requisito.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirRequisitoEtapa(id: string, quadroId: string): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.from('colunas_requisitos').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir o requisito.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function marcarRequisitoConcluido(
  cartaoId: string,
  requisitoId: string,
  quadroId: string,
  concluido: boolean
): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes_requisitos_status').upsert(
    {
      cartao_id: cartaoId,
      requisito_id: requisitoId,
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null,
    },
    { onConflict: 'cartao_id,requisito_id' }
  )
  if (error) return { ok: false, error: 'Falha ao atualizar o requisito.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
