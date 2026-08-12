'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser, requireGestor } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { hojeEmSaoPaulo } from '@/lib/semana'
import type { ActionResult } from '@/lib/action-result'

export type Correcao = {
  id: string
  colaboradorNome: string
  demandaNome: string
  data: string
  quantidade: number
  tempoManualMin: number | null
  justificativa: string
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA'
  criadoEm: string
}

const pedidoSchema = z.object({
  demandaId: z.string().uuid('Escolha uma demanda'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  quantidade: z.coerce.number().positive('Quantidade tem que ser maior que zero'),
  tempoManualMin: z.coerce.number().int().positive().optional(),
  motivo: z.string().optional(),
  observacoes: z.string().optional(),
  justificativa: z
    .string()
    .trim()
    .min(10, 'Explique por que o lançamento não foi feito no dia — o gestor decide com base nisso'),
})

/**
 * Pedido de lançamento retroativo.
 *
 * A regra "só se lança hoje" continua valendo no banco: a policy de insert em
 * `apontamentos` segue exigindo `data = CURRENT_DATE`. Isto não a contorna —
 * cria um pedido que só um gestor converte em lançamento.
 */
export async function pedirCorrecao(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const parsed = pedidoSchema.safeParse({
    demandaId: formData.get('demandaId'),
    data: formData.get('data'),
    quantidade: formData.get('quantidade'),
    tempoManualMin: formData.get('tempoManualMin') || undefined,
    motivo: formData.get('motivo') || undefined,
    observacoes: formData.get('observacoes') || undefined,
    justificativa: formData.get('justificativa'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // O check da tabela também barra, mas a mensagem de constraint não explica.
  if (parsed.data.data >= hojeEmSaoPaulo()) {
    return { ok: false, error: 'Para hoje, use o lançamento normal. Aqui é só para dias anteriores.' }
  }

  const { error } = await supabase.from('apontamentos_correcoes').insert({
    organizacao_id: profile.organizacao_id,
    colaborador_id: user.id,
    demanda_id: parsed.data.demandaId,
    data: parsed.data.data,
    quantidade: parsed.data.quantidade,
    tempo_manual_min: parsed.data.tempoManualMin ?? null,
    motivo: parsed.data.motivo ?? null,
    observacoes: parsed.data.observacoes ?? null,
    justificativa: parsed.data.justificativa,
  })

  if (error) {
    console.error('Falha ao pedir correção: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível enviar o pedido.' }
  }

  revalidatePath('/apontamento/historico')
  revalidatePath('/minha-semana')
  return { ok: true }
}

const ERROS_RPC: Record<string, string> = {
  'APENAS_GESTOR: so um gestor pode aprovar correcao de apontamento': 'Só um gestor pode aprovar.',
  'APENAS_GESTOR: so um gestor pode rejeitar correcao de apontamento': 'Só um gestor pode recusar.',
  CORRECAO_NAO_ENCONTRADA: 'Este pedido já foi decidido por outra pessoa.',
  CONTA_INATIVA: 'A conta de quem pediu está inativa.',
  DEMANDA_INATIVA: 'A demanda do pedido não está mais ativa.',
  TEMPO_OBRIGATORIO: 'A demanda é variável e o pedido não trouxe tempo.',
  TEMPO_EXCEDE_CARGA: 'O tempo pedido passa da carga horária de quem pediu.',
  BLOCOS_EXCEDIDOS: 'A quantidade passa do total de blocos da demanda.',
  DEMANDA_SEM_TEMPO_PADRAO: 'A demanda não tem tempo padrão configurado.',
}

export async function aprovarCorrecao(id: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.rpc('aprovar_correcao_apontamento', { p_id: id })
  if (error) {
    const chave = error.message ?? ''
    if (!ERROS_RPC[chave]) console.error('Erro ao aprovar correção:', error)
    return { ok: false, error: ERROS_RPC[chave] ?? 'Não foi possível aprovar o pedido.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'apontamento.correcao_aprovada',
    entidade: 'apontamentos_correcoes',
    entidadeId: id,
  }, profile.organizacao_id)

  revalidatePath('/apontamento/historico')
  revalidatePath('/minha-semana')
  revalidatePath('/dashboard')
  revalidatePath('/gestao')
  return { ok: true }
}

export async function rejeitarCorrecao(id: string, motivo?: string): Promise<ActionResult> {
  const { user, profile } = await requireGestor()
  const supabase = await createClient()

  const { error } = await supabase.rpc('rejeitar_correcao_apontamento', { p_id: id, p_motivo: motivo })
  if (error) {
    const chave = error.message ?? ''
    if (!ERROS_RPC[chave]) console.error('Erro ao rejeitar correção:', error)
    return { ok: false, error: ERROS_RPC[chave] ?? 'Não foi possível recusar o pedido.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'apontamento.correcao_rejeitada',
    entidade: 'apontamentos_correcoes',
    entidadeId: id,
  }, profile.organizacao_id)

  revalidatePath('/apontamento/historico')
  revalidatePath('/minha-semana')
  return { ok: true }
}

/** Pedidos visíveis para quem chama — a RLS já separa próprio de gestor. */
export async function listarCorrecoes(): Promise<ActionResult<Correcao[]>> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('apontamentos_correcoes')
    .select('id, data, quantidade, tempo_manual_min, justificativa, status, criado_em, colaboradores!apontamentos_correcoes_colaborador_id_fkey(nome), demandas(nome)')
    .order('criado_em', { ascending: false })
    .limit(100)

  if (error) return { ok: false, error: 'Não foi possível carregar os pedidos.' }

  return {
    ok: true,
    data: (data ?? []).map((c) => {
      const colab = Array.isArray(c.colaboradores) ? c.colaboradores[0] : c.colaboradores
      const dem = Array.isArray(c.demandas) ? c.demandas[0] : c.demandas
      return {
        id: c.id,
        colaboradorNome: colab?.nome ?? '—',
        demandaNome: dem?.nome ?? '—',
        data: c.data,
        quantidade: Number(c.quantidade),
        tempoManualMin: c.tempo_manual_min,
        justificativa: c.justificativa,
        status: c.status,
        criadoEm: c.criado_em,
      }
    }),
  }
}
