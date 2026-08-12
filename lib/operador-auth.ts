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
  if (!operador) redirect('/minha-semana')

  return { ...session, operador }
}

/** Client com service role para o console do operador — nunca use fora daqui. */
export async function operadorClient() {
  await requireOperador()
  return createAdminClient()
}

/**
 * Trilha das ações do operador sobre organizações de clientes.
 *
 * NÃO usa `auditoria`: aquela tabela tem FK composta (ator_id,
 * organizacao_id) → colaboradores, e o operador não é colaborador de
 * organização nenhuma. O insert falha com 23503 e registrarAuditoria()
 * engole no try/catch — foi assim que suspender e reativar cliente ficou
 * sem registro até agora.
 *
 * Diferente da auditoria de inquilino, aqui a falha é LOGADA com destaque
 * mas não derruba a ação: perder o registro é ruim, desfazer uma ativação
 * de cliente por causa do registro é pior.
 */
export async function registrarAcaoOperador(e: {
  operadorId: string
  acao: string
  organizacaoId?: string | null
  organizacaoNome?: string | null
  detalhes?: Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('operadores_acoes').insert({
      operador_id: e.operadorId,
      acao: e.acao,
      organizacao_id: e.organizacaoId ?? null,
      organizacao_nome: e.organizacaoNome ?? null,
      detalhes: (e.detalhes ?? null) as never,
    })
    if (error) {
      console.error('TRILHA DO OPERADOR NÃO REGISTRADA: acao=%s org=%s code=%s message=%s',
        e.acao, e.organizacaoId, error.code, error.message)
    }
  } catch (err) {
    console.error('TRILHA DO OPERADOR NÃO REGISTRADA: acao=%s erro=%s', e.acao, err)
  }
}
