import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// A Vercel envia "Authorization: Bearer ${CRON_SECRET}" automaticamente
// quando a env CRON_SECRET existe no projeto. Sem a env, nega tudo.
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`
}

// E-mails vivem em auth.users, não em colaboradores.
// perPage 1000 cobre a equipe com folga; paginação fica para quando doer.
export async function getEmailMap(
  admin: SupabaseClient<Database>
): Promise<Map<string, string>> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const map = new Map<string, string>()
  for (const u of data.users) {
    if (u.email) map.set(u.id, u.email)
  }
  return map
}

// Trava de idempotência: (tipo, chave) é único em cron_execucoes, então só
// a primeira chamada pra um período (dia/janela/semana) consegue reservar —
// retry da Vercel ou hit manual da rota vira no-op em vez de reenviar e-mail.
export async function tentarReservarExecucao(
  admin: SupabaseClient<Database>,
  tipo: string,
  chave: string
): Promise<boolean> {
  const { error } = await admin.from('cron_execucoes').insert({ tipo, chave })
  if (error) {
    if (error.code === '23505') return false // já reservado por uma execução anterior
    throw error
  }
  return true
}
