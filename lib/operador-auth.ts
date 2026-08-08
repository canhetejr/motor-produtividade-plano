import 'server-only'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Guard do console do operador (a Tera, dona da plataforma — não a empresa
 * cliente). Modelo: lib/admin-guard.ts.
 *
 * `operadores` tem RLS ligada e ZERO políticas — de propósito, é
 * intransponível por design, só o service role lê. Isso significa que a
 * checagem "esta pessoa é operador?" não pode ser feita com o client normal
 * (RLS devolveria sempre zero linhas, mesmo para quem é operador de verdade)
 * — tem que ser feita no código, com o client de service role.
 *
 * Igual ao admin-guard: a checagem e o bypass vêm juntos. Não existe caminho
 * para obter o client de service role do console do operador sem antes
 * passar por requireOperador().
 */
export async function requireOperador() {
  const session = await requireUser()

  const admin = createAdminClient()
  const { data: operador } = await admin
    .from('operadores')
    .select('user_id, nome')
    .eq('user_id', session.user.id)
    .maybeSingle()

  // Mesmo padrão de requireAdmin(): quem não tem linha em `operadores` volta
  // para a tela de trabalho do dia a dia, não para uma tela de erro — hoje a
  // tabela está vazia, então isto redireciona todo mundo, o que é esperado.
  if (!operador) redirect('/apontamento')

  return { ...session, operador }
}

/** Client com service role para o console do operador — nunca use fora daqui. */
export async function operadorClient() {
  await requireOperador()
  return createAdminClient()
}
