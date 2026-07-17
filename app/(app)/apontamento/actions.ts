'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireUser } from '@/lib/auth'
import { hoje } from '@/lib/dates'
import type { ActionResult } from '@/lib/action-result'

const apontamentoSchema = z.object({
  demanda_id: z.string().uuid('Selecione uma demanda válida'),
  // aceita decimais: demandas em blocos permitem meio bloco (0.5)
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  tempo_manual_min: z.coerce
    .number()
    .int('Tempo deve ser um número inteiro de minutos')
    .positive('Tempo deve ser maior que zero')
    .nullable()
    .catch(null),
  observacoes: z
    .string()
    .trim()
    .max(2000, 'Observações muito longas (máx. 2000 caracteres)')
    .optional()
    .transform((v) => v || null),
})

export async function createApontamento(formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsed = apontamentoSchema.safeParse({
    demanda_id: formData.get('demanda_id'),
    quantidade: formData.get('quantidade'),
    tempo_manual_min: formData.get('tempo_manual_min') || null,
    observacoes: formData.get('observacoes') ?? undefined,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const { error } = await supabase.from('apontamentos').insert({
    colaborador_id: user.id,
    demanda_id: parsed.data.demanda_id,
    quantidade: parsed.data.quantidade,
    tempo_manual_min: parsed.data.tempo_manual_min,
    observacoes: parsed.data.observacoes,
    data: hoje(),
  })

  if (error) {
    console.error('Erro ao salvar apontamento:', error)
    return { ok: false, error: 'Falha ao salvar apontamento. Tente novamente.' }
  }

  revalidatePath('/apontamento')
  revalidatePath('/apontamento/historico')
  return { ok: true }
}
