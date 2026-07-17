'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApontamento(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  const demanda_id = formData.get('demanda_id') as string
  const quantidade = parseInt(formData.get('quantidade') as string) || 1
  const observacoes = formData.get('observacoes') as string
  const tempo_manual_min = formData.get('tempo_manual_min') 
    ? parseInt(formData.get('tempo_manual_min') as string)
    : null

  const { error } = await supabase
    .from('apontamentos')
    .insert({
      colaborador_id: user.id,
      demanda_id,
      quantidade,
      observacoes,
      tempo_manual_min,
      data: new Date().toISOString().split('T')[0] // current date
    })

  if (error) {
    console.error('Erro ao salvar apontamento:', error)
    return { error: 'Falha ao salvar apontamento.' }
  }

  revalidatePath('/apontamento')
  revalidatePath('/apontamento/historico')
  return { success: true }
}
