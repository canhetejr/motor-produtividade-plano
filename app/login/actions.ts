'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

import { registrarAuditoria } from '@/lib/auditoria'
import { iniciarDesafioMfa } from './mfa-actions'

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
    // Um erro de rede/config (ex.: chave mal colada) chega aqui igual a uma senha
    // errada, mas nao e culpa de quem esta logando — separar os dois casos evita
    // mandar o usuario tentar de novo uma senha que esta certa.
    const falhaDeCredencial = error?.status === 400 || error?.status === 401
    if (error && !falhaDeCredencial) {
      console.error('[login] falha nao relacionada a credencial:', {
        status: error.status,
        code: error.code,
        message: error.message,
      })
      redirect(
        '/login?message=' +
          encodeURIComponent('Não foi possível conectar ao servidor. Avise o suporte.'),
      )
    }
    redirect('/login?message=' + encodeURIComponent('E-mail ou senha inválidos.'))
  }

  await registrarAuditoria({
    atorId: authData.user.id,
    acao: 'auth.login',
    entidade: 'auth',
    depois: { email: parsed.data.email },
  })

  // Segundo fator, quando a pessoa o ativou. A sessao ja existe neste ponto; o
  // que a proxy bloqueia e o uso do app ate o codigo ser conferido.
  const { data: perfil } = await supabase
    .from('colaboradores')
    .select('nome, mfa_email_ativo')
    .eq('id', authData.user.id)
    .single()

  if (perfil?.mfa_email_ativo) {
    await iniciarDesafioMfa(authData.user.id, perfil.nome, parsed.data.email)
    revalidatePath('/', 'layout')
    redirect('/login/verificar')
  }

  revalidatePath('/', 'layout')
  redirect('/apontamento')
}


// Não há cadastro público: contas são criadas pelo gestor em /colaboradores.
