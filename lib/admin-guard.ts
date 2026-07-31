import 'server-only'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Client com service role para o console de admin.
 *
 * O escopo é mais estreito do que parece: `is_quadro_membro()` já devolve true
 * para `auth_role() = 'gestor'`, e admin ⊃ gestor por constraint — então
 * quadros, membros, cartões, automações e e-mails o admin lê com o client
 * normal, respeitando RLS. Não vale gastar bypass onde a policy já concorda.
 *
 * O que sobra é `cron_execucoes`: a migration 20260722040000 fez
 * `revoke all ... from anon, authenticated` e não criou policy nenhuma, de
 * propósito (só os crons escrevem lá, com service role). É a única tabela que
 * o console precisa ler e que RLS fecha para todo mundo.
 *
 * O ponto deste wrapper é que a checagem e o bypass vêm juntos: não existe
 * como obter o client sem antes passar por requireAdmin(). Chamar
 * createAdminClient() direto dentro de app/(app)/admin/ é o que este módulo
 * existe para evitar.
 *
 * Escrita de privilégio (conceder/revogar admin) NÃO passa por aqui — vai
 * pela RPC definir_admin, que carrega a própria checagem no banco.
 */
export async function adminClient() {
  await requireAdmin()
  return createAdminClient()
}
