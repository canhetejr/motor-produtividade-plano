'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireUser } from '@/lib/auth'
import { notificarGestores } from '@/lib/notifications'
import { ERROS_RPC_APONTAMENTO } from '@/lib/apontamento-erros'
import { parseTempo } from '@/lib/tempo'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'

// Acima disso (fração da carga horária do dia), o gestor recebe um aviso —
// não bloqueia o lançamento, só dá visibilidade de um "Outros" grande.
const LIMITE_NOTIFICACAO_OUTROS = 0.5

const apontamentoSchema = z.object({
  demanda_id: z.string().uuid('Selecione uma demanda válida'),
  // aceita decimais: demandas em blocos permitem meio bloco (0.5)
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

export async function createApontamento(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = apontamentoSchema.safeParse({
    demanda_id: formData.get('demanda_id'),
    quantidade: formData.get('quantidade'),
    tempo_manual_min: formData.get('tempo_manual_min') || null,
    motivo: formData.get('motivo') ?? undefined,
    observacoes: formData.get('observacoes') ?? undefined,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  // registrar_apontamento (RPC, SECURITY DEFINER) é a fonte de verdade das
  // regras de negócio (motivo/teto de blocos/tempo manual/demanda ativa) —
  // o INSERT direto em apontamentos foi revogado de `authenticated`. O Zod
  // acima ainda dá feedback rápido de formato antes do round-trip.
  const { data: novoApontamento, error } = await supabase.rpc('registrar_apontamento', {
    p_demanda_id: parsed.data.demanda_id,
    p_quantidade: parsed.data.quantidade,
    // Os parâmetros abaixo são nuláveis na função (motivo/observações opcionais,
    // tempo_manual_min só existe em lançamentos de "Outros"), mas os tipos
    // gerados marcam os args da RPC como não-nuláveis — a assinatura real no
    // Postgres aceita NULL. Cast só de tipo, sem mudar o valor enviado.
    p_tempo_manual_min: parsed.data.tempo_manual_min as unknown as number,
    p_motivo: parsed.data.motivo as unknown as string,
    p_observacoes: parsed.data.observacoes as unknown as string,
  })

  if (error || !novoApontamento) {
    const codigo = error?.message ?? ''
    if (!ERROS_RPC_APONTAMENTO[codigo]) console.error('Erro ao salvar apontamento:', error)
    return { ok: false, error: ERROS_RPC_APONTAMENTO[codigo] ?? 'Falha ao salvar apontamento. Tente novamente.' }
  }

  // Variável é identificado por tempo_manual_min preenchido (mesma
  // convenção da view apontamentos_calculado) — não precisa reconsultar a
  // demanda só pra saber se era "Outros".
  if (
    novoApontamento.tempo_manual_min &&
    novoApontamento.tempo_manual_min > profile.carga_horaria_min * LIMITE_NOTIFICACAO_OUTROS
  ) {
    await notificarGestores(
      {
        tipo: 'outros_grande',
        titulo: 'Lançamento de "Outros" acima do esperado',
        mensagem: `${profile.nome} lançou ${novoApontamento.tempo_manual_min} min em "Outros" (${novoApontamento.motivo}).`,
        link: `/gestao/equipe/${user.id}`,
      },
      profile.organizacao_id
    )
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'apontamento.criar',
    entidade: 'apontamentos',
    entidadeId: novoApontamento.id,
    depois: novoApontamento,
  }, profile.organizacao_id)

  revalidatePath('/apontamento/historico')
  revalidatePath('/minha-semana')
  return { ok: true }
}
