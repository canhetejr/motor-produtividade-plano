'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { NIVEIS_COMPLEXIDADE } from '@/lib/produtividade'
import type { ActionResult } from '@/lib/action-result'

const reguaSchema = z.object({
  baixa: z.coerce.number().int().positive(),
  media: z.coerce.number().int().positive(),
  alta: z.coerce.number().int().positive(),
  muito_alta: z.coerce.number().int().positive(),
})

/**
 * Recalibra a régua de complexidade da organização.
 *
 * Vale só daqui para frente: `produtividade_execucoes.tempo_esperado_min` é
 * snapshot, congelado na gravação. Mudar a régua não reescreve a
 * produtividade que já foi medida — se reescrevesse, um ajuste de 30 para 45
 * minutos hoje faria a equipe parecer mais produtiva no mês passado.
 */
export async function salvarReguaComplexidade(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const parsed = reguaSchema.safeParse({
    baixa: formData.get('baixa'),
    media: formData.get('media'),
    alta: formData.get('alta'),
    muito_alta: formData.get('muito_alta'),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Cada nível precisa de um número inteiro de minutos maior que zero.' }
  }

  // A ordem não é validada: uma organização pode legitimamente ter "alta" e
  // "muito alta" com o mesmo tempo enquanto ainda calibra. Barrar aqui
  // impediria um estado intermediário legítimo por causa de uma suposição
  // sobre como o gestor chega ao número final.
  const linhas = NIVEIS_COMPLEXIDADE.map((nivel) => ({
    organizacao_id: profile.organizacao_id,
    nivel,
    minutos_referencia: parsed.data[nivel],
    atualizado_em: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('complexidade_niveis')
    .upsert(linhas, { onConflict: 'organizacao_id,nivel' })

  if (error) {
    console.error('Erro ao salvar régua de complexidade: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível salvar a régua. Tente novamente.' }
  }

  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'complexidade.calibrar',
      entidade: 'complexidade_niveis',
      depois: parsed.data,
    },
    profile.organizacao_id
  )

  revalidatePath('/gestao/produtividade')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  return { ok: true }
}
