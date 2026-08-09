import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// A Vercel envia "Authorization: Bearer ${CRON_SECRET}" automaticamente
// quando a env CRON_SECRET existe no projeto. Sem a env, nega tudo.
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`
}

// E-mails vivem em auth.users, não em colaboradores. Resolve só os ids
// passados (escopados a uma organização) em vez de listar o projeto inteiro
// — listUsers({perPage:1000}) misturava e-mail de todas as organizações no
// mesmo Map (vazamento de PII entre inquilinos) e quebrava em silêncio acima
// de mil contas no projeto todo.
export async function getEmailsPorId(
  admin: SupabaseClient<Database>,
  colaboradorIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = [...new Set(colaboradorIds)]
  await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error || !data.user?.email) return
      map.set(id, data.user.email)
    })
  )
  return map
}

// Trava de idempotência: (tipo, organizacao_id, chave) é único em
// cron_execucoes, então só a primeira chamada pra um período (dia/janela/
// semana) de uma organização consegue reservar — retry da Vercel ou hit
// manual da rota vira no-op em vez de reenviar e-mail. Antes da coluna
// organizacao_id, a chave era só (tipo, chave): a primeira organização a
// rodar reservava a execução do dia inteiro e as demais viravam no-op
// silencioso (insert batia em 23505 e o código achava que já tinha
// processado) — só um cliente recebia e-mail.
export async function tentarReservarExecucao(
  admin: SupabaseClient<Database>,
  tipo: string,
  organizacaoId: string,
  chave: string
): Promise<boolean> {
  const { error } = await admin.from('cron_execucoes').insert({ tipo, organizacao_id: organizacaoId, chave })
  if (error) {
    if (error.code === '23505') return false // já reservado por uma execução anterior
    throw error
  }
  return true
}

// Mesma trava, para o cron que age sobre a plataforma inteira e não pertence
// a organização nenhuma (o de ciclo de vida). Depende de a unique de
// cron_execucoes ser NULLS NOT DISTINCT — sem isso o Postgres considera cada
// NULL diferente do outro e a reserva nunca colide (migration
// 20260809200000).
export async function tentarReservarExecucaoGlobal(
  admin: SupabaseClient<Database>,
  tipo: string,
  chave: string
): Promise<boolean> {
  const { error } = await admin.from('cron_execucoes').insert({ tipo, organizacao_id: null, chave })
  if (error) {
    if (error.code === '23505') return false
    throw error
  }
  return true
}

// Registra a execução SEM travar a próxima — o oposto de
// tentarReservarExecucao().
//
// Existe para crons de reconciliação, que são rede de segurança e precisam
// poder ser rodados à mão de novo no mesmo dia depois de corrigir a causa de
// uma falha. Sem registro nenhum, porém, o painel de saúde do console mostra
// "nunca" para sempre e vira alarme falso — foi o que aconteceu com o
// google-calendar-sync, declarado no painel e nunca gravando.
export async function registrarExecucao(
  admin: SupabaseClient<Database>,
  tipo: string,
  organizacaoId: string,
  chave: string
): Promise<void> {
  const { error } = await admin
    .from('cron_execucoes')
    .upsert(
      { tipo, organizacao_id: organizacaoId, chave, executado_em: new Date().toISOString() },
      { onConflict: 'tipo,organizacao_id,chave' }
    )
  // Falha aqui é perda de observabilidade, não de trabalho: o cron já rodou.
  if (error) console.error('Falha ao registrar execução de cron %s:', tipo, error)
}

// Organizações elegíveis para processamento por cron: mesmo critério de
// `org_atual()` na skill de isolamento (trialing/ativa). Suspensa/expirada
// não deve receber e-mail nem ser varrida pelos crons.
export async function organizacoesAtivas(
  admin: SupabaseClient<Database>
): Promise<{ id: string }[]> {
  const { data, error } = await admin
    .from('organizacoes')
    .select('id')
    .in('status', ['trialing', 'ativa'])
  if (error) throw error
  return data ?? []
}

// Falha numa organização não pode abortar o processamento das demais — cada
// cron chama isto por organização dentro de um try/catch próprio e acumula
// os resultados em vez de devolver 500 na primeira falha.
export type ResultadoPorOrganizacao<T> =
  | { organizacaoId: string; ok: true; resultado: T }
  | { organizacaoId: string; ok: false; erro: string }

export async function paraCadaOrganizacao<T>(
  admin: SupabaseClient<Database>,
  processar: (organizacaoId: string) => Promise<T>
): Promise<ResultadoPorOrganizacao<T>[]> {
  const organizacoes = await organizacoesAtivas(admin)
  const resultados: ResultadoPorOrganizacao<T>[] = []
  for (const org of organizacoes) {
    try {
      const resultado = await processar(org.id)
      resultados.push({ organizacaoId: org.id, ok: true, resultado })
    } catch (erro) {
      resultados.push({
        organizacaoId: org.id,
        ok: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      })
    }
  }
  return resultados
}
