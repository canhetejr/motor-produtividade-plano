'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireUser } from '@/lib/auth'
import { hoje } from '@/lib/dates'
import { ERROS_RPC_APONTAMENTO } from '@/lib/apontamento-erros'
import { parseTempo } from '@/lib/tempo'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'

const apontamentoUpdateSchema = z.object({
  demanda_id: z.string().uuid('Selecione uma demanda válida'),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  tempo_manual_min: z
    .preprocess(
      (v) => parseTempo(v as string | number),
      z.number().int('Tempo deve ser um número inteiro de minutos').positive('Tempo deve ser maior que zero').nullable()
    )
    .catch(null),
  motivo: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  observacoes: z
    .string()
    .trim()
    .max(2000, 'Observações muito longas (máx. 2000 caracteres)')
    .optional()
    .transform((v) => v || null),
})

// Só o dia atual — mesma regra do delete abaixo. atualizar_apontamento (RPC,
// SECURITY DEFINER) valida motivo/teto de blocos/tempo manual/demanda ativa
// no banco, igual createApontamento faz pra criação.
export async function updateApontamento(id: string, formData: FormData): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) return { ok: false, error: 'Apontamento inválido.' }

  const parsed = apontamentoUpdateSchema.safeParse({
    demanda_id: formData.get('demanda_id'),
    quantidade: formData.get('quantidade'),
    tempo_manual_min: formData.get('tempo_manual_min') || null,
    motivo: formData.get('motivo') ?? undefined,
    observacoes: formData.get('observacoes') ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const { data: antes } = await supabase.from('apontamentos').select('*').eq('id', parsedId.data).single()

  const { data, error } = await supabase.rpc('atualizar_apontamento', {
    p_id: parsedId.data,
    p_demanda_id: parsed.data.demanda_id,
    p_quantidade: parsed.data.quantidade,
    p_tempo_manual_min: parsed.data.tempo_manual_min,
    p_motivo: parsed.data.motivo,
    p_observacoes: parsed.data.observacoes,
  })

  if (error || !data) {
    const codigo = error?.message ?? ''
    if (!ERROS_RPC_APONTAMENTO[codigo]) console.error('Erro ao atualizar apontamento:', error)
    return { ok: false, error: ERROS_RPC_APONTAMENTO[codigo] ?? 'Falha ao atualizar apontamento. Tente novamente.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'apontamento.atualizar',
    entidade: 'apontamentos',
    entidadeId: parsedId.data,
    antes,
    depois: data,
  })

  revalidatePath('/apontamento')
  revalidatePath('/apontamento/historico')
  revalidatePath('/dashboard')
  revalidatePath('/gestao')
  return { ok: true }
}

export async function deleteApontamento(id: string): Promise<ActionResult> {
  const { user } = await requireUser()

  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) {
    return { ok: false, error: 'Apontamento inválido.' }
  }

  const supabase = await createClient()

  const { data: antes } = await supabase.from('apontamentos').select('*').eq('id', parsed.data).single()

  // RLS já impede deletar de outros; aqui reforçamos a regra "só do dia atual"
  const { error } = await supabase
    .from('apontamentos')
    .delete()
    .eq('id', parsed.data)
    .eq('colaborador_id', user.id)
    .eq('data', hoje())

  if (error) {
    console.error('Erro ao deletar apontamento:', error)
    return { ok: false, error: 'Falha ao excluir. O apontamento pode não ser de hoje.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'apontamento.excluir',
    entidade: 'apontamentos',
    entidadeId: parsed.data,
    antes,
  })

  revalidatePath('/apontamento/historico')
  revalidatePath('/dashboard')
  revalidatePath('/gestao')
  return { ok: true }
}

