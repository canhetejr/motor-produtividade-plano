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
  let authData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error']
  try {
    ;({ data: authData, error } = await supabase.auth.signInWithPassword(parsed.data))
  } catch (err) {
    // DIAGNOSTICO TEMPORARIO — Next mascara a mensagem real do cliente com um
    // "digest"; isso captura o erro de fetch cru (nao um AuthError do supabase-js)
    // pra aparecer no log do servidor. Remover depois de achar a causa.
    console.error('[login][diagnostico] excecao crua no signInWithPassword:', {
      name: (err as Error)?.name,
      message: (err as Error)?.message,
      cause: (err as { cause?: unknown })?.cause,
      stack: (err as Error)?.stack,
    })
    redirect('/login?message=' + encodeURIComponent('Erro temporário — tente novamente.'))
  }

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
