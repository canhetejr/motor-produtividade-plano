'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'

const metaSchema = z
  .object({
    // Um dos dois, nunca os dois — mesma restrição do check da tabela, checada
    // aqui só para dar mensagem legível em vez de erro de constraint.
    colaboradorId: z.string().uuid().optional(),
    areaId: z.string().uuid().optional(),
    alvo: z.coerce.number().gt(0, 'A meta tem que ser maior que zero').lte(3, 'Meta acima de 300% da jornada não faz sentido'),
    vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  })
  .refine((d) => Boolean(d.colaboradorId) !== Boolean(d.areaId), {
    message: 'Escolha uma pessoa ou uma área, não as duas',
  })

export async function definirMeta(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = metaSchema.safeParse({
    colaboradorId: (formData.get('colaboradorId') as string) || undefined,
    areaId: (formData.get('areaId') as string) || undefined,
    alvo: formData.get('alvo'),
    vigenteDesde: formData.get('vigenteDesde'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('metas').insert({
    colaborador_id: parsed.data.colaboradorId ?? null,
    area_id: parsed.data.areaId ?? null,
    alvo: parsed.data.alvo,
    vigente_desde: parsed.data.vigenteDesde,
    criado_por: user.id,
    organizacao_id: profile.organizacao_id,
  })
  if (error) {
    console.error('Falha ao definir meta: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível salvar a meta.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'meta.definir',
    entidade: 'metas',
    depois: parsed.data,
  }, profile.organizacao_id)

  revalidatePath('/dashboard')
  revalidatePath('/gestao')
  return { ok: true }
}

export async function removerMeta(id: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.from('metas').delete().eq('id', id)
  if (error) return { ok: false, error: 'Não foi possível remover a meta.' }

  await registrarAuditoria({ atorId: user.id, acao: 'meta.remover', entidade: 'metas', entidadeId: id }, profile.organizacao_id)
  revalidatePath('/dashboard')
  revalidatePath('/gestao')
  return { ok: true }
}
