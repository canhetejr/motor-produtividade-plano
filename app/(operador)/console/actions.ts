'use server'

import { revalidatePath } from 'next/cache'
import { requireOperador } from '@/lib/operador-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'

const STATUS_VALIDOS = ['trialing', 'ativa', 'suspensa', 'expirada', 'excluindo'] as const
type StatusOrganizacao = (typeof STATUS_VALIDOS)[number]

// Único endpoint de escrita do console do operador hoje. Usa service role
// porque `organizacoes` não tem política de UPDATE para ninguém fora do dono
// da plataforma — nem o admin da empresa pode mudar o próprio status (senão
// uma organização suspensa se reativaria sozinha).
export async function definirStatusOrganizacao(
  organizacaoId: string,
  status: StatusOrganizacao
): Promise<ActionResult> {
  const { user } = await requireOperador()

  if (!STATUS_VALIDOS.includes(status)) {
    return { ok: false, error: 'Status inválido.' }
  }

  const admin = createAdminClient()

  const { data: antes } = await admin
    .from('organizacoes')
    .select('nome, status')
    .eq('id', organizacaoId)
    .maybeSingle()

  if (!antes) return { ok: false, error: 'Organização não encontrada.' }

  // trialing exige trial_expira_em (constraint `(status = 'trialing') =
  // (trial_expira_em is not null)`) — o operador não tem tela para escolher
  // essa data, então essa transição fica fora do que este botão oferece.
  if (status === 'trialing') {
    return { ok: false, error: 'Volta para trial não é feita por aqui — ajuste trial_expira_em no banco.' }
  }

  const { error } = await admin
    .from('organizacoes')
    .update({
      status,
      suspensa_em: status === 'suspensa' ? new Date().toISOString() : null,
    })
    .eq('id', organizacaoId)

  if (error) {
    console.error('Erro ao mudar status de organização:', error)
    return { ok: false, error: 'Falha ao mudar o status da organização.' }
  }

  // organizacaoId aqui é o alvo da mudança, não o do operador (operadores
  // não pertence a nenhuma organização) — é o registro correto para uma
  // trilha que existe para auditar decisões sobre organizações de clientes.
  await registrarAuditoria(
    {
      atorId: user.id,
      acao: 'operador.organizacao_status',
      entidade: 'organizacoes',
      entidadeId: organizacaoId,
      antes,
      depois: { ...antes, status },
    },
    organizacaoId
  )

  revalidatePath('/console')
  return { ok: true }
}
