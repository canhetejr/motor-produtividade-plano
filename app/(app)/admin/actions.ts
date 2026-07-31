'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import type { ActionResult } from '@/lib/action-result'

// Só o que não existe em outro lugar mora aqui. Arquivar quadro e ligar/
// desligar automação já são `arquivarQuadro` (kanban/actions.ts) e
// `alternarAutomacaoAtiva` (kanban/actions-automacoes.ts) — o console importa
// as duas em vez de manter uma segunda versão que envelheceria em separado.
// Ambas pedem requireGestor(), e admin ⊃ gestor por constraint.

// As exceções da RPC definir_admin vêm no formato CODIGO:detalhe, mesmo
// contrato de lib/kanban-regras.ts. Traduzir aqui evita vazar texto cru do
// Postgres na interface.
function traduzirErroAdmin(mensagem: string): string {
  if (mensagem.includes('APENAS_ADMIN')) {
    return 'Só um admin pode conceder ou revogar acesso de admin.'
  }
  if (mensagem.includes('PRECISA_SER_GESTOR')) {
    return 'Promova a pessoa a gestor antes de conceder acesso de admin.'
  }
  if (mensagem.includes('ULTIMO_ADMIN')) {
    return 'O sistema precisa de pelo menos um admin ativo — promova outra pessoa antes de se rebaixar.'
  }
  if (mensagem.includes('COLABORADOR_INEXISTENTE')) {
    return 'Colaborador não encontrado.'
  }
  return 'Falha ao alterar o acesso de admin.'
}

export async function definirAdmin(colaboradorId: string, conceder: boolean): Promise<ActionResult> {
  const { user } = await requireAdmin()
  const supabase = await createClient()

  const { data: antes } = await supabase
    .from('colaboradores')
    .select('nome, role, admin')
    .eq('id', colaboradorId)
    .single()

  // Via RPC, não UPDATE: a checagem mora dentro da função (SECURITY DEFINER),
  // então nem um caminho de código futuro que esqueça requireAdmin() passa.
  const { error } = await supabase.rpc('definir_admin', {
    p_colaborador_id: colaboradorId,
    p_admin: conceder,
  })

  if (error) {
    console.error('Erro ao definir admin:', error)
    return { ok: false, error: traduzirErroAdmin(error.message) }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: conceder ? 'admin.conceder' : 'admin.revogar',
    entidade: 'colaboradores',
    entidadeId: colaboradorId,
    antes,
    depois: { ...antes, admin: conceder },
  })

  revalidatePath('/admin')
  revalidatePath('/catalogo')
  return { ok: true }
}

// Entrar num quadro de que não se é membro. O admin já *enxerga* o quadro
// (is_quadro_membro devolve true para gestor), mas sem vínculo ele não aparece
// como responsável possível nem recebe notificação — entrar de verdade deixa
// rastro na auditoria em vez de agir por fora.
export async function entrarNoQuadro(quadroId: string): Promise<ActionResult> {
  const { user } = await requireAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('quadros_membros')
    .upsert({ quadro_id: quadroId, colaborador_id: user.id }, { onConflict: 'quadro_id,colaborador_id' })

  if (error) {
    console.error('Erro ao entrar no quadro:', error)
    return { ok: false, error: 'Falha ao entrar no quadro.' }
  }

  await registrarAuditoria({
    atorId: user.id,
    acao: 'admin.entrou_quadro',
    entidade: 'quadros',
    entidadeId: quadroId,
    depois: { colaborador_id: user.id },
  })

  revalidatePath('/admin')
  revalidatePath('/kanban')
  return { ok: true }
}
