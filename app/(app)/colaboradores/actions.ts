'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { ActionResult } from '@/lib/action-result'

const perfilSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  area_id: z.string().uuid('Selecione uma área'),
  carga_horaria_min: z.coerce
    .number()
    .int('Carga horária deve ser em minutos inteiros')
    .positive('Carga horária deve ser maior que zero'),
  role: z.enum(['colaborador', 'gestor'], { message: 'Perfil inválido' }),
})

const novoColaboradorSchema = perfilSchema.extend({
  email: z.string().trim().email('Informe um e-mail válido'),
  password: z.string().min(6, 'Senha temporária deve ter ao menos 6 caracteres'),
})

export async function updateColaborador(id: string, formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = perfilSchema
    .extend({ ativo: z.boolean() })
    .safeParse({
      nome: formData.get('nome'),
      area_id: formData.get('area_id'),
      carga_horaria_min: formData.get('carga_horaria_min'),
      role: formData.get('role'),
      ativo: formData.get('ativo') === 'on',
    })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const { error } = await supabase.from('colaboradores').update(parsed.data).eq('id', id)
  if (error) {
    console.error('Erro ao atualizar colaborador:', error)
    return { ok: false, error: 'Falha ao atualizar o colaborador.' }
  }

  revalidatePath('/colaboradores')
  return { ok: true }
}

export async function createColaborador(formData: FormData): Promise<ActionResult> {
  await requireGestor()

  const parsed = novoColaboradorSchema.safeParse({
    nome: formData.get('nome'),
    email: formData.get('email'),
    password: formData.get('password'),
    area_id: formData.get('area_id'),
    carga_horaria_min: formData.get('carga_horaria_min'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para criar contas.',
    }
  }

  // Admin API: cria a conta já confirmada, sem depender de e-mail de verificação
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (authError || !created.user) {
    console.error('Erro ao criar usuário:', authError)
    return { ok: false, error: authError?.message ?? 'Falha ao criar usuário no Auth.' }
  }

  const { error: dbError } = await admin.from('colaboradores').insert({
    id: created.user.id,
    nome: parsed.data.nome,
    area_id: parsed.data.area_id,
    carga_horaria_min: parsed.data.carga_horaria_min,
    role: parsed.data.role,
    ativo: true,
  })

  if (dbError) {
    console.error('Erro ao salvar perfil:', dbError)
    // desfaz a conta órfã para permitir nova tentativa com o mesmo e-mail
    await admin.auth.admin.deleteUser(created.user.id)
    return { ok: false, error: 'Falha ao salvar o perfil do colaborador. Tente novamente.' }
  }

  revalidatePath('/colaboradores')
  return { ok: true }
}
