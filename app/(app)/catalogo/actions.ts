'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/lib/action-result'

const areaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da área'),
})

const demandaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da demanda'),
  tempo_padrao_min: z.coerce
    .number()
    .int('Tempo padrão deve ser em minutos inteiros')
    .positive('Tempo padrão deve ser maior que zero')
    .nullable()
    .catch(null),
  variavel: z.boolean(),
  blocos_totais: z.coerce
    .number()
    .int('Blocos deve ser um número inteiro')
    .min(1, 'Blocos deve ser no mínimo 1')
    .catch(1),
})

// === AREAS ===

export async function createArea(formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = areaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('areas').insert(parsed.data)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe uma área com esse nome.' : 'Falha ao criar a área.',
    }
  }

  revalidatePath('/catalogo')
  return { ok: true }
}

export async function updateArea(id: string, formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = areaSchema.safeParse({ nome: formData.get('nome') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('areas').update(parsed.data).eq('id', id)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? 'Já existe uma área com esse nome.' : 'Falha ao atualizar a área.',
    }
  }

  revalidatePath('/catalogo')
  return { ok: true }
}

// === DEMANDAS ===

export async function createDemanda(formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const area_id = z.string().uuid().safeParse(formData.get('area_id'))
  if (!area_id.success) return { ok: false, error: 'Selecione uma área.' }

  const parsed = demandaSchema.safeParse({
    nome: formData.get('nome'),
    tempo_padrao_min: formData.get('tempo_padrao_min') || null,
    variavel: formData.get('variavel') === 'on',
    blocos_totais: formData.get('blocos_totais') || 1,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('demandas').insert({
    area_id: area_id.data,
    ...parsed.data,
  })
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Já existe uma demanda com esse nome nesta área.'
          : 'Falha ao criar a demanda.',
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/apontamento')
  return { ok: true }
}

export async function updateDemanda(id: string, formData: FormData): Promise<ActionResult> {
  await requireGestor()
  const supabase = await createClient()

  const parsed = demandaSchema
    .extend({ ativo: z.boolean() })
    .safeParse({
      nome: formData.get('nome'),
      tempo_padrao_min: formData.get('tempo_padrao_min') || null,
      variavel: formData.get('variavel') === 'on',
      ativo: formData.get('ativo') === 'on',
      blocos_totais: formData.get('blocos_totais') || 1,
    })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { error } = await supabase.from('demandas').update(parsed.data).eq('id', id)
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Já existe uma demanda com esse nome nesta área.'
          : 'Falha ao atualizar a demanda.',
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/apontamento')
  return { ok: true }
}
