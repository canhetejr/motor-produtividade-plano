'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

import { registrarAuditoria } from '@/lib/auditoria'

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    redirect('/login?message=' + encodeURIComponent(parsed.error.issues[0].message))
  }

  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !authData.user) {
    redirect('/login?message=' + encodeURIComponent('E-mail ou senha inválidos.'))
  }

  await registrarAuditoria({
    atorId: authData.user.id,
    acao: 'auth.login',
    entidade: 'auth',
    depois: { email: parsed.data.email },
  })

  revalidatePath('/', 'layout')
  redirect('/apontamento')
}


// Não há cadastro público: contas são criadas pelo gestor em /colaboradores.
