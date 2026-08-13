'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'
import type { ActionResult } from '@/lib/action-result'

// Service role pelo mesmo motivo de app/(app)/perfil/actions.ts: a política
// colaboradores_update_gestor só deixa gestor escrever na tabela, e o setup é
// justamente a tela que todo mundo vê na primeira entrada — inclusive quem é
// só colaborador. O id vem de requireUser(), nunca do formulário, e o filtro
// por organização fica explícito porque o bypass não tem rede de proteção.
export async function concluirSetup(): Promise<ActionResult> {
  const { user, profile } = await requireUser()

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para concluir o setup.',
    }
  }

  const { error } = await admin
    .from('colaboradores')
    .update({ setup_concluido_em: new Date().toISOString() })
    .eq('id', user.id)
    .eq('organizacao_id', profile.organizacao_id)

  if (error) {
    console.error('Erro ao concluir setup: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível concluir o setup. Tente de novo em instantes.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
