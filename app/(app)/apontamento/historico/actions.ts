'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteApontamento(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  // Only delete if it belongs to user AND is from today
  // RLS should block deleting others, but we also enforce "dia atual"
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('apontamentos')
    .delete()
    .eq('id', id)
    .eq('colaborador_id', user.id)
    .eq('data', today)

  if (error) {
    console.error('Erro ao deletar apontamento:', error)
    return { error: 'Falha ao deletar. O apontamento pode não ser de hoje.' }
  }

  revalidatePath('/apontamento/historico')
  revalidatePath('/dashboard')
  return { success: true }
}
