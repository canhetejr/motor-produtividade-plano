'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { requireUser } from '@/lib/auth'
import { notificarGestores } from '@/lib/notifications'
import { ERROS_RPC_APONTAMENTO } from '@/lib/apontamento-erros'
import { apontamentoSchema } from '@/lib/apontamento-schema'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'
import type { Database } from '@/lib/database.types'

// Acima disso (fração da carga horária do dia), o gestor recebe um aviso —
// não bloqueia o lançamento, só dá visibilidade de um "Outros" grande.
const LIMITE_NOTIFICACAO_OUTROS = 0.5

/**
 * Núcleo de createApontamento, sem requireUser()/createClient(): recebe o
 * client já autenticado (cookie de sessão OU, via
 * lib/mcp/tools/apontamentos.ts, o client impersonado de um token MCP) e a
 * identidade já resolvida. A tool MCP reusa exatamente esta função em vez
 * de duplicar a chamada à RPC e as regras em volta dela.
 */
export async function registrarApontamentoCore(
  supabase: SupabaseClient<Database>,
  ctx: { userId: string; profile: { organizacao_id: string; carga_horaria_min: number; nome: string } },
  input: z.infer<typeof apontamentoSchema>
): Promise<ActionResult> {
  // registrar_apontamento (RPC, SECURITY DEFINER) é a fonte de verdade das
  // regras de negócio (motivo/teto de blocos/tempo manual/demanda ativa) —
  // o INSERT direto em apontamentos foi revogado de `authenticated`. O Zod
  // do schema (validado pelos dois chamadores) ainda dá feedback rápido de
  // formato antes do round-trip.
  const { data: novoApontamento, error } = await supabase.rpc('registrar_apontamento', {
    p_demanda_id: input.demanda_id,
    p_quantidade: input.quantidade,
    // Os parâmetros abaixo são nuláveis na função (motivo/observações opcionais,
    // tempo_manual_min só existe em lançamentos de "Outros"), mas os tipos
    // gerados marcam os args da RPC como não-nuláveis — a assinatura real no
    // Postgres aceita NULL. Cast só de tipo, sem mudar o valor enviado.
    p_tempo_manual_min: input.tempo_manual_min as unknown as number,
    p_motivo: input.motivo as unknown as string,
    p_observacoes: input.observacoes as unknown as string,
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
    novoApontamento.tempo_manual_min > ctx.profile.carga_horaria_min * LIMITE_NOTIFICACAO_OUTROS
  ) {
    await notificarGestores(
      {
        tipo: 'outros_grande',
        titulo: 'Lançamento de "Outros" acima do esperado',
        mensagem: `${ctx.profile.nome} lançou ${novoApontamento.tempo_manual_min} min em "Outros" (${novoApontamento.motivo}).`,
        link: `/gestao/equipe/${ctx.userId}`,
      },
      ctx.profile.organizacao_id
    )
  }

  await registrarAuditoria({
    atorId: ctx.userId,
    acao: 'apontamento.criar',
    entidade: 'apontamentos',
    entidadeId: novoApontamento.id,
    depois: novoApontamento,
  }, ctx.profile.organizacao_id)

  revalidatePath('/apontamento')
  revalidatePath('/apontamento/historico')
  return { ok: true }
}

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

  return registrarApontamentoCore(supabase, { userId: user.id, profile }, parsed.data)
}

