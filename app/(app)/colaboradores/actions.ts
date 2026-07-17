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

export async function updateColaborador(id: string, formData: FormData) {
  const supabase = await checkGestor()
  
  const nome = formData.get('nome') as string
  const area_id = formData.get('area_id') as string
  const carga_horaria_min = parseInt(formData.get('carga_horaria_min') as string)
  const role = formData.get('role') as string
  const ativo = formData.get('ativo') === 'on'

  const { error } = await supabase.from('colaboradores').update({
    nome,
    area_id,
    carga_horaria_min,
    role,
    ativo
  }).eq('id', id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/colaboradores')
  return { success: true }
}

import { createClient as createTempClient } from '@supabase/supabase-js'

export async function createColaborador(formData: FormData) {
  const supabase = await checkGestor()
  
  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const area_id = formData.get('area_id') as string
  const carga_horaria_min = parseInt(formData.get('carga_horaria_min') as string)
  const role = formData.get('role') as string

  // Cria cliente isolado para não sobrescrever a sessão do gestor
  const tempClient = createTempClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: authData, error: authError } = await tempClient.auth.signUp({
    email,
    password
  })

  if (authError) return { error: authError.message }

  if (!authData.user) return { error: 'Falha ao criar usuário no Auth' }

  const { error: dbError } = await supabase.from('colaboradores').upsert({
    id: authData.user.id,
    nome,
    area_id,
    carga_horaria_min,
    role,
    ativo: true
  })

  if (dbError) {
    return { error: 'Usuário criado, mas falha ao salvar perfil: ' + dbError.message }
  }

  revalidatePath('/colaboradores')
  return { success: true }
}
