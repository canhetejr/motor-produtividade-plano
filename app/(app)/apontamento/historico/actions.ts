'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireUser } from '@/lib/auth'
import { hoje } from '@/lib/dates'
import type { ActionResult } from '@/lib/action-result'

export async function deleteApontamento(id: string): Promise<ActionResult> {
  const { user } = await requireUser()

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) {
    return { ok: false, error: 'Apontamento inválido.' }
  }

  const supabase = await createClient()

  // RLS já impede deletar de outros; aqui reforçamos a regra "só do dia atual"
  const { error } = await supabase
    .from('apontamentos')
    .delete()
    .eq('id', parsed.data)
    .eq('colaborador_id', user.id)
    .eq('data', hoje())

  if (error) {
    console.error('Erro ao deletar apontamento:', error)
    return { ok: false, error: 'Falha ao excluir. O apontamento pode não ser de hoje.' }
  }

  revalidatePath('/apontamento/historico')
  revalidatePath('/dashboard')
  return { ok: true }
}
