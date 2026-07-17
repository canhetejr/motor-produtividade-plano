'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function checkGestor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('colaboradores')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'gestor') {
    throw new Error('Acesso negado')
  }
  return supabase
}

// === AREAS ===

export async function createArea(formData: FormData) {
  const supabase = await checkGestor()
  const nome = formData.get('nome') as string

  const { error } = await supabase.from('areas').insert({ nome })
  if (error) return { error: error.message }
  
  revalidatePath('/catalogo')
  return { success: true }
}

export async function updateArea(id: string, formData: FormData) {
  const supabase = await checkGestor()
  const nome = formData.get('nome') as string

  const { error } = await supabase.from('areas').update({ nome }).eq('id', id)
  if (error) return { error: error.message }
  
  revalidatePath('/catalogo')
  return { success: true }
}

// === DEMANDAS ===

export async function createDemanda(formData: FormData) {
  const supabase = await checkGestor()
  
  const area_id = formData.get('area_id') as string
  const nome = formData.get('nome') as string
  const tempo_padrao_min = formData.get('tempo_padrao_min') ? parseInt(formData.get('tempo_padrao_min') as string) : null
  const variavel = formData.get('variavel') === 'on'
  const blocos_totais = formData.get('blocos_totais') ? parseInt(formData.get('blocos_totais') as string) : 1

  const { error } = await supabase.from('demandas').insert({
    area_id,
    nome,
    tempo_padrao_min,
    variavel,
    blocos_totais
  })
  if (error) return { error: error.message }
  
  revalidatePath('/catalogo')
  return { success: true }
}

export async function updateDemanda(id: string, formData: FormData) {
  const supabase = await checkGestor()
  
  const nome = formData.get('nome') as string
  const tempo_padrao_min = formData.get('tempo_padrao_min') ? parseInt(formData.get('tempo_padrao_min') as string) : null
  const variavel = formData.get('variavel') === 'on'
  const ativo = formData.get('ativo') === 'on'
  const blocos_totais = formData.get('blocos_totais') ? parseInt(formData.get('blocos_totais') as string) : 1

  const { error } = await supabase.from('demandas').update({
    nome,
    tempo_padrao_min,
    variavel,
    ativo,
    blocos_totais
  }).eq('id', id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/catalogo')
  return { success: true }
}
