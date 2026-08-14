'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { NIVEIS_COMPLEXIDADE, EXECUCOES_PARA_SUGERIR, sugerirTempoFixo } from '@/lib/produtividade'
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

/**
 * Vira uma demanda de tempo variável em tempo fixo, com a média medida.
 *
 * O gestor decide; o sistema só propõe. Nada aqui roda sozinho — trocar a
 * régua de uma demanda muda como o trabalho de todo mundo passa a ser
 * contado, e uma mudança dessas acontecendo por conta própria numa
 * terça-feira é como se perde a confiança no número.
 *
 * Os minutos são recalculados no servidor a partir do histórico, e não
 * lidos do formulário: o cliente manda o id da demanda, não quanto tempo
 * ela deve passar a valer.
 */
export async function aplicarTempoFixoSugerido(demandaId: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const id = z.string().uuid().safeParse(demandaId)
  if (!id.success) return { ok: false, error: 'Demanda inválida.' }

  const [{ data: demanda }, { data: resumo }] = await Promise.all([
    supabase.from('demandas').select('id, nome, variavel, tempo_padrao_min, complexidade').eq('id', id.data).maybeSingle(),
    supabase
      .from('demandas_produtividade_resumo')
      .select('execucoes, media_real_min, min_real_min, max_real_min')
      .eq('demanda_id', id.data)
      .maybeSingle(),
  ])

  if (!demanda) return { ok: false, error: 'Demanda não encontrada.' }
  if (!demanda.variavel) return { ok: false, error: 'Esta demanda já tem tempo padrão.' }

  const sugestao =
    resumo && resumo.execucoes !== null && resumo.media_real_min !== null
      ? sugerirTempoFixo({
          execucoes: resumo.execucoes,
          media_real_min: resumo.media_real_min,
          min_real_min: resumo.min_real_min ?? 0,
          max_real_min: resumo.max_real_min ?? 0,
        })
      : null

  if (!sugestao) {
    return {
      ok: false,
      error: `Ainda não há execuções suficientes: são necessárias ${EXECUCOES_PARA_SUGERIR}.`,
    }
  }

  const { error } = await supabase
    .from('demandas')
    .update({
      variavel: false,
      tempo_padrao_min: sugestao.minutos,
      // A complexidade era o esperado provisório; com tempo padrão ela
      // deixa de valer, e mantê-la daria duas réguas para a mesma demanda.
      complexidade: null,
    })
    .eq('id', id.data)

  if (error) {
    console.error('Erro ao fixar tempo padrão: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível fixar o tempo padrão.' }
  }

  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'demanda.fixar_tempo',
      entidade: 'demandas',
      entidadeId: id.data,
      antes: { variavel: true, tempo_padrao_min: demanda.tempo_padrao_min, complexidade: demanda.complexidade },
      depois: { variavel: false, tempo_padrao_min: sugestao.minutos, execucoes: sugestao.execucoes },
    },
    profile.organizacao_id
  )

  revalidatePath('/gestao/produtividade')
  revalidatePath('/gestao/catalogo')
  revalidatePath('/minhas-demandas')
  revalidatePath('/apontamento')
  return { ok: true }
}
