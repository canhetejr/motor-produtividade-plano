'use server'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { obterConfigPush } from '@/lib/push'
import type { ActionResult } from '@/lib/action-result'

/**
 * A chave pública sai por action, e não por leitura da tabela.
 *
 * `config_push` não tem grant para papel nenhum além do de serviço — a privada
 * fica a uma coluna de distância da pública, e um `select` mal escrito no futuro
 * não pode alcançá-la.
 */
export async function obterChavePublicaPush(): Promise<ActionResult<{ chave: string }>> {
  await requireUser()
  const config = await obterConfigPush()
  if (!config) return { ok: false, error: 'Push não está disponível no servidor.' }
  return { ok: true, data: { chave: config.chavePublica } }
}

export async function registrarInscricaoPush(assinatura: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<ActionResult> {
  const { user } = await requireUser()
  const supabase = await createClient()

  // upsert por endpoint: reinstalar o app gera endpoint novo, mas reabrir a
  // mesma instalação devolve o mesmo — sem isso a tabela acumularia duplicata a
  // cada visita.
  const { error } = await supabase.from('push_inscricoes').upsert(
    {
      colaborador_id: user.id,
      endpoint: assinatura.endpoint,
      p256dh: assinatura.p256dh,
      auth: assinatura.auth,
      invalida_em: null,
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('Falha ao registrar push: code=%s message=%s', error.code, error.message)
    return { ok: false, error: 'Não foi possível ativar as notificações.' }
  }
  return { ok: true }
}

export async function removerInscricaoPush(endpoint: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('push_inscricoes').delete().eq('endpoint', endpoint)
  if (error) return { ok: false, error: 'Não foi possível desativar as notificações.' }
  return { ok: true }
}
