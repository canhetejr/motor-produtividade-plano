import { requireOperador } from '@/lib/operador-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { throwIfError } from '@/lib/supabase-error'
import { CRONS_DECLARADOS, ENVS_ESPERADAS, avaliarCron } from '@/lib/admin-saude'
import { ConsoleOperador } from './console-operador'

export const dynamic = 'force-dynamic'

// Rota fora de app/(app)/ de propósito: o layout de (app) chama
// requireUser() e monta a navegação da empresa (sidebar de quadros,
// apontamento, catálogo...) — nada disso faz sentido para o operador da
// plataforma, que não pertence a organização nenhuma. requireOperador() já
// chama requireUser() por dentro, então a sessão continua exigida; só a
// casca de navegação da empresa é que fica de fora.
export default async function ConsoleOperadorPage() {
  await requireOperador()

  // Tudo aqui é service role de propósito: o operador não tem organizacao_id,
  // então org_atual() devolve NULL para ele e toda política do eixo fecharia
  // a leitura — inclusive a de organizacoes, que é exatamente o que esta
  // tela existe para listar entre organizações.
  const admin = createAdminClient()

  const [{ data: organizacoes, error: organizacoesError }, { data: cronExecucoes, error: cronError }] =
    await Promise.all([
      admin
        .from('organizacoes')
        .select('id, nome, slug, status, limite_assentos, trial_expira_em, criado_em')
        .order('criado_em', { ascending: false }),
      admin.from('cron_execucoes').select('tipo, executado_em').order('executado_em', { ascending: false }).limit(200),
    ])
  throwIfError(organizacoesError, cronError)

  const assentosPorOrg = new Map<string, number>()
  await Promise.all(
    (organizacoes ?? []).map(async (o) => {
      const { data, error } = await admin.rpc('assentos_ocupados', { p_org: o.id })
      if (error) {
        console.error('Falha ao contar assentos ocupados para organização %s:', o.id, error)
        return
      }
      assentosPorOrg.set(o.id, data ?? 0)
    })
  )

  const ultimaPorTipo = new Map<string, string>()
  for (const e of cronExecucoes ?? []) {
    if (!ultimaPorTipo.has(e.tipo)) ultimaPorTipo.set(e.tipo, e.executado_em)
  }
  const saudeCrons = CRONS_DECLARADOS.map((c) => avaliarCron(c, ultimaPorTipo.get(c.tipo) ?? null))

  const envs = ENVS_ESPERADAS.map((e) => ({
    ...e,
    presente: Boolean(process.env[e.nome]),
  }))

  const organizacoesDetalhadas = (organizacoes ?? []).map((o) => ({
    id: o.id,
    nome: o.nome,
    slug: o.slug,
    status: o.status,
    limiteAssentos: o.limite_assentos,
    assentosOcupados: assentosPorOrg.get(o.id) ?? 0,
    trialExpiraEm: o.trial_expira_em,
    criadoEm: o.criado_em,
  }))

  return <ConsoleOperador organizacoes={organizacoesDetalhadas} crons={saudeCrons} envs={envs} />
}
