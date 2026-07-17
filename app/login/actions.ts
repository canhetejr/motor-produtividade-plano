'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  redirect('/apontamento')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: authData, error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/login?message=Could not authenticate user')
  }

  // Auto-insert into colaboradores to allow testing
  if (authData.user) {
    // For local test, making the first user a 'gestor' would be cool, but let's default to 'gestor' if no users exist, or just make them gestor for test
    const { count } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true })
    const role = count === 0 ? 'gestor' : 'colaborador'

    await supabase.from('colaboradores').insert({
      id: authData.user.id,
      nome: authData.user.email?.split('@')[0] || 'Teste',
      role: role
    })
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Check email to continue sign in process')
}
