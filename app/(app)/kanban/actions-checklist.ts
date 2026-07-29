'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'
import type { ChecklistItem } from './[quadroId]/types'

const textoSchema = z.string().trim().min(1, 'Informe o texto do item').max(300, 'Item muito longo (máx. 300 caracteres)')

export async function listarChecklist(cartaoId: string): Promise<ActionResult<ChecklistItem[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cartoes_checklist_itens')
    .select('id, texto, concluido, posicao')
    .eq('cartao_id', cartaoId)
    .order('posicao')

  if (error) return { ok: false, error: 'Falha ao carregar o checklist.' }
  return { ok: true, data: data ?? [] }
}

export async function criarItemChecklist(cartaoId: string, quadroId: string, texto: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const parsed = textoSchema.safeParse(texto)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { count } = await supabase
    .from('cartoes_checklist_itens')
    .select('id', { count: 'exact', head: true })
    .eq('cartao_id', cartaoId)

  const { error } = await supabase
    .from('cartoes_checklist_itens')
    .insert({ cartao_id: cartaoId, texto: parsed.data, posicao: count ?? 0 })
  if (error) return { ok: false, error: 'Falha ao adicionar o item.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function alternarItemChecklist(id: string, quadroId: string, concluido: boolean): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes_checklist_itens').update({ concluido }).eq('id', id)
  if (error) return { ok: false, error: 'Falha ao atualizar o item.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}

export async function excluirItemChecklist(id: string, quadroId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('cartoes_checklist_itens').delete().eq('id', id)
  if (error) return { ok: false, error: 'Falha ao excluir o item.' }

  revalidatePath(`/kanban/${quadroId}`)
  return { ok: true }
}
