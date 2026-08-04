import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { adminClient } from '@/lib/admin-guard'
import { throwIfError } from '@/lib/supabase-error'
import { hoje as hojeMaringa, ehDiaUtil, horaEmMaringa } from '@/lib/dates'
import { montarAchados } from '@/lib/admin-diagnostico'
import { AdminConsole } from '../../admin/admin-console'
import { CRONS_DECLARADOS, ENVS_ESPERADAS, avaliarCron, type SaudeCron } from '@/lib/admin-saude'

export const dynamic = 'force-dynamic'

const TABS = ['visao-geral', 'quadros', 'automacoes', 'sistema'] as const

export default async function SistemaPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requireAdmin()
  const searchParams = await props.searchParams

  // Sistema reúne os controles globais e continua
  // reservado a administradores, porque expõe saúde do sistema e controles de

  const supabase = await createClient()

  const agora = new Date()
  // hoje() do lib/dates fixa America/Sao_Paulo. `dataLocalISO` seguiria o fuso
  // da máquina — na Vercel isso é UTC, e depois das 21h de Maringá o "hoje"
  // viraria o dia seguinte, contando apontamentos do dia errado. É a mesma
  // função que os crons usam.
  const hoje = hojeMaringa()
  const ha7dias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const ha24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Tudo abaixo o admin lê com o client normal: is_quadro_membro() já devolve
  // true para gestor, e admin ⊃ gestor por constraint. Só cron_execucoes
  // precisa de service role (ver lib/admin-guard.ts).
  const [
    { data: colaboradores, error: colaboradoresError },
    { data: quadros, error: quadrosError },
    { data: membros, error: membrosError },
    { data: automacoes, error: automacoesError },
    { data: execucoes, error: execucoesError },
    { count: cartoesAbertos },
    { count: emailsSemana },
    { count: apontamentosHoje },
    // --- dados do diagnóstico ---
    { data: acoesAutomacoes, error: acoesError },
    { count: cartoesSemDemanda },
    { data: colunasFinais, error: colunasError },
    { data: demandasSemTempo, error: demandasError },
    { data: sessoesAbertas, error: sessoesError },
    { data: apontaramHoje, error: apontaramError },
  ] = await Promise.all([
    supabase.from('colaboradores').select('id, nome, carga_horaria_min, ativo').order('nome'),
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
    supabase.from('automacoes_acoes').select('automacao_id, tipo, ordem').order('ordem'),
    supabase
      .from('cartoes')
      .select('id', { count: 'exact', head: true })
      .is('demanda_id', null)
      .is('entregue_em', null),
    supabase.from('colunas').select('quadro_id').eq('etapa_final', true),
    // Espelha o filtro de app/(app)/apontamento/page.tsx
    // (`variavel.eq.true,tempo_padrao_min.not.is.null`): demanda ativa, não
    // variável e sem tempo padrão é exatamente a que some do formulário.
    supabase.from('demandas').select('nome').eq('ativo', true).eq('variavel', false).is('tempo_padrao_min', null),
    supabase.from('cartoes_sessoes_tempo').select('colaborador_id, iniciado_em').is('finalizado_em', null),
    supabase.from('apontamentos').select('colaborador_id').eq('data', hoje),
  ])
  throwIfError(
    colaboradoresError,
    quadrosError,
    membrosError,
    automacoesError,
    execucoesError,
    acoesError,
    colunasError,
    demandasError,
    sessoesError,
    apontaramError
  )

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
  const acoesPorAutomacao = new Map<string, string[]>()
  for (const a of acoesAutomacoes ?? []) {
    acoesPorAutomacao.set(a.automacao_id, [...(acoesPorAutomacao.get(a.automacao_id) ?? []), a.tipo])
  }

  const automacoesDetalhadas = (automacoes ?? []).map((a) => {
    const stats = execucoesPorAutomacao.get(a.id) ?? { ok: 0, erro: 0, cortado: 0, ultimoErro: null }
    return {
      id: a.id,
      nome: a.nome,
      evento: a.evento,
      ativa: a.ativa,
      quadroId: a.quadro_id,
      quadroNome: nomeQuadroPorId.get(a.quadro_id) ?? '—',
      acoes: acoesPorAutomacao.get(a.id) ?? [],
      ...stats,
    }
  })

  // --- diagnóstico -----------------------------------------------------
  const quadrosAtivos = (quadros ?? []).filter((q) => q.ativo)
  const quadrosComEtapaFinal = new Set((colunasFinais ?? []).map((c) => c.quadro_id))
  const cargaPorId = new Map((colaboradores ?? []).map((c) => [c.id, c.carga_horaria_min]))

  // Sessão aberta que já passou da carga diária de quem a abriu: quando for
  // pausada, `registrar_apontamento_timer` vai recusá-la (a trava impede que
  // um timer esquecido a noite toda gere 14h e destrua o índice) — então o
  // trabalho real daquele dia se perde em silêncio.
  const sessoesEstouradas = (sessoesAbertas ?? [])
    .map((s) => {
      const cargaMin = cargaPorId.get(s.colaborador_id) ?? 480
      const horas = (agora.getTime() - new Date(s.iniciado_em).getTime()) / 3_600_000
      return {
        colaborador: nomePorId.get(s.colaborador_id) ?? '—',
        horas,
        cargaHoras: Math.round(cargaMin / 60),
      }
    })
    .filter((s) => s.horas > s.cargaHoras)
    .sort((a, b) => b.horas - a.horas)

  const jaApontou = new Set((apontaramHoje ?? []).map((a) => a.colaborador_id))
  const naoApontaramHoje = (colaboradores ?? [])
    .filter((c) => c.ativo && !jaApontou.has(c.id))
    .map((c) => c.nome)

  const achados = montarAchados({
    cartoesSemDemanda: cartoesSemDemanda ?? 0,
    quadrosSemEtapaFinal: quadrosAtivos.filter((q) => !quadrosComEtapaFinal.has(q.id)).map((q) => q.nome),
    quadrosSemMembros: quadrosAtivos.filter((q) => (contagemMembros.get(q.id) ?? 0) === 0).map((q) => q.nome),
    demandasSemTempoPadrao: (demandasSemTempo ?? []).map((d) => d.nome),
    sessoesEstouradas,
    sessoesAbertas: (sessoesAbertas ?? []).length,
    naoApontaramHoje,
    ehDiaUtil: ehDiaUtil(),
    horaMaringa: horaEmMaringa(agora),
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
      quadros={quadrosDetalhados}
      automacoes={automacoesDetalhadas}
      crons={saudeCrons}
      envs={envs}
      achados={achados}
      metricas={{
        cartoesAbertos: cartoesAbertos ?? 0,
        emailsSemana: emailsSemana ?? 0,
        apontamentosHoje: apontamentosHoje ?? 0,
        errosUltimas24h,
        sessoesAbertas: (sessoesAbertas ?? []).length,
      }}
      defaultTab={defaultTab}
    />
  )
}
