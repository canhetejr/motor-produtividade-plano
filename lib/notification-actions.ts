'use server'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'

export async function marcarNotificacaoLida(id: string): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('id', id)
    .eq('destinatario_id', user.id)

  if (error) return { ok: false, error: 'Falha ao marcar notificação como lida.' }
  return { ok: true }
}

export async function marcarTodasNotificacoesLidas(): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('destinatario_id', user.id)
    .eq('lida', false)

  if (error) return { ok: false, error: 'Falha ao marcar notificações como lidas.' }
  return { ok: true }
}
