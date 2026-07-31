import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { adminClient } from '@/lib/admin-guard'
import { throwIfError } from '@/lib/supabase-error'
import { dataLocalISO } from '@/lib/tempo'
import { AdminConsole } from './admin-console'
import { CRONS_DECLARADOS, ENVS_ESPERADAS, avaliarCron, type SaudeCron } from '@/lib/admin-saude'

export const dynamic = 'force-dynamic'

const TABS = ['visao-geral', 'pessoas', 'quadros', 'automacoes', 'sistema'] as const

export default async function AdminPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requireAdmin()
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const agora = new Date()
  const hoje = dataLocalISO(agora)
  const ha7dias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const ha24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Tudo abaixo o admin lê com o client normal: is_quadro_membro() já devolve
  // true para gestor, e admin ⊃ gestor por constraint. Só cron_execucoes
  // precisa de service role (ver lib/admin-guard.ts).
  const [
    { data: colaboradores, error: colaboradoresError },
    { data: areas, error: areasError },
    { data: quadros, error: quadrosError },
    { data: membros, error: membrosError },
    { data: automacoes, error: automacoesError },
    { data: execucoes, error: execucoesError },
    { count: cartoesAbertos },
    { count: emailsSemana },
    { count: apontamentosHoje },
  ] = await Promise.all([
    supabase.from('colaboradores').select('id, nome, area_id, carga_horaria_min, role, admin, ativo').order('nome'),
    supabase.from('areas').select('id, nome, ativo').order('nome'),
    supabase.from('quadros').select('id, nome, codigo, ativo, criado_por, created_at').order('created_at', { ascending: false }),
    supabase.from('quadros_membros').select('quadro_id, colaborador_id'),
    supabase.from('automacoes').select('id, quadro_id, nome, evento, ativa, created_at').order('quadro_id'),
    supabase
      .from('automacoes_execucoes')
      .select('id, automacao_id, status, erro, executado_em')
      .gte('executado_em', ha7dias)
      .order('executado_em', { ascending: false })
      .limit(500),
    supabase.from('cartoes').select('id', { count: 'exact', head: true }).is('entregue_em', null),
    supabase.from('cartoes_emails').select('id', { count: 'exact', head: true }).gte('enviado_em', ha7dias),
    supabase.from('apontamentos').select('id', { count: 'exact', head: true }).eq('data', hoje),
  ])
  throwIfError(colaboradoresError, areasError, quadrosError, membrosError, automacoesError, execucoesError)

  // cron_execucoes não tem policy nenhuma e é revogada de `authenticated`
  // (migration 20260722040000) — é a única leitura do console que precisa de
  // service role. Degrada para "sem dados" em vez de derrubar a página se a
  // chave não estiver configurada no ambiente.
  let saudeCrons: SaudeCron[] = CRONS_DECLARADOS.map((c) => avaliarCron(c, null))
  try {
    const admin = await adminClient()
    const { data: cronExecucoes } = await admin
      .from('cron_execucoes')
      .select('tipo, executado_em')
      .order('executado_em', { ascending: false })
      .limit(200)

    const ultimaPorTipo = new Map<string, string>()
    for (const e of cronExecucoes ?? []) {
      if (!ultimaPorTipo.has(e.tipo)) ultimaPorTipo.set(e.tipo, e.executado_em)
    }
    saudeCrons = CRONS_DECLARADOS.map((c) => avaliarCron(c, ultimaPorTipo.get(c.tipo) ?? null))
  } catch (err) {
    console.error('Falha ao ler cron_execucoes para o painel de admin:', err)
  }

  const contagemMembros = new Map<string, number>()
  for (const m of membros ?? []) {
    contagemMembros.set(m.quadro_id, (contagemMembros.get(m.quadro_id) ?? 0) + 1)
  }
  const meusQuadros = new Set((membros ?? []).filter((m) => m.colaborador_id === user.id).map((m) => m.quadro_id))
  const nomePorId = new Map((colaboradores ?? []).map((c) => [c.id, c.nome]))

  const quadrosDetalhados = (quadros ?? []).map((q) => ({
    id: q.id,
    nome: q.nome,
    codigo: q.codigo,
    ativo: q.ativo,
    criadoEm: q.created_at,
    dono: nomePorId.get(q.criado_por) ?? '—',
    // O quadro cujo dono foi desativado é o caso que motivou esta aba: sem
    // ninguém responsável, ele some da gestão do dia a dia.
    donoAtivo: (colaboradores ?? []).find((c) => c.id === q.criado_por)?.ativo ?? false,
    membros: contagemMembros.get(q.id) ?? 0,
    souMembro: meusQuadros.has(q.id),
  }))

  const execucoesPorAutomacao = new Map<string, { ok: number; erro: number; cortado: number; ultimoErro: string | null }>()
  for (const e of execucoes ?? []) {
    const atual = execucoesPorAutomacao.get(e.automacao_id) ?? { ok: 0, erro: 0, cortado: 0, ultimoErro: null }
    if (e.status === 'ok') atual.ok += 1
    else if (e.status === 'erro') {
      atual.erro += 1
      if (!atual.ultimoErro) atual.ultimoErro = e.erro
    } else atual.cortado += 1
    execucoesPorAutomacao.set(e.automacao_id, atual)
  }

  const nomeQuadroPorId = new Map((quadros ?? []).map((q) => [q.id, q.nome]))
  const automacoesDetalhadas = (automacoes ?? []).map((a) => {
    const stats = execucoesPorAutomacao.get(a.id) ?? { ok: 0, erro: 0, cortado: 0, ultimoErro: null }
    return {
      id: a.id,
      nome: a.nome,
      evento: a.evento,
      ativa: a.ativa,
      quadroId: a.quadro_id,
      quadroNome: nomeQuadroPorId.get(a.quadro_id) ?? '—',
      ...stats,
    }
  })

  const errosUltimas24h = (execucoes ?? []).filter(
    (e) => e.status === 'erro' && e.executado_em >= ha24h
  ).length

  const envs = ENVS_ESPERADAS.map((e) => ({
    ...e,
    // Só a presença. O valor nunca sai do servidor — um painel de admin é
    // exatamente o lugar onde vazar segredo dói mais.
    presente: Boolean(process.env[e.nome]),
  }))

  const defaultTab = TABS.includes(searchParams.tab as (typeof TABS)[number]) ? searchParams.tab : undefined

  return (
    <AdminConsole
      meuId={user.id}
      colaboradores={colaboradores ?? []}
      areas={areas ?? []}
      quadros={quadrosDetalhados}
      automacoes={automacoesDetalhadas}
      crons={saudeCrons}
      envs={envs}
      metricas={{
        cartoesAbertos: cartoesAbertos ?? 0,
        emailsSemana: emailsSemana ?? 0,
        apontamentosHoje: apontamentosHoje ?? 0,
        errosUltimas24h,
      }}
      defaultTab={defaultTab}
    />
  )
}
