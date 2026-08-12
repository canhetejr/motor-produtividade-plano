import { requireOperador } from '@/lib/operador-auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { throwIfError } from '@/lib/supabase-error'
import { CRONS_DECLARADOS, ENVS_ESPERADAS, avaliarCron } from '@/lib/admin-saude'
import { ConsoleOperador } from './console-operador'
import type { AssinaturaManualOperador } from './tipos'

export const dynamic = 'force-dynamic'

const DIAS_SEM_ATIVIDADE_PARA_RISCO = 14

// react-hooks/purity mira Date.now() dentro do que ele reconhece como
// componente (por nome/formato) — mesmo em Server Component, que roda uma
// vez por requisição e onde o horário real é exatamente o que se quer.
// Mesmo helper de app/(app)/layout.tsx.
function agoraMs(): number {
  return Date.now()
}

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

  const [
    { data: organizacoes, error: organizacoesError },
    { data: cronExecucoes, error: cronError },
    { data: acoes, error: acoesError },
    { data: planos, error: planosError },
    { data: assinaturas, error: assinaturasError },
  ] = await Promise.all([
    admin
      .from('organizacoes')
      .select('id, nome, slug, status, limite_assentos, trial_expira_em, excluir_em, criado_em, plano_id')
      .order('criado_em', { ascending: false }),
    admin.from('cron_execucoes').select('tipo, executado_em').order('executado_em', { ascending: false }).limit(200),
    admin
      .from('operadores_acoes')
      .select('id, acao, organizacao_nome, detalhes, criado_em')
      .order('criado_em', { ascending: false })
      .limit(15),
    admin.from('planos').select('id, nome, codigo, assentos_inclusos, preco_mensal_centavos, ativo, ordem').order('ordem').order('nome'),
    admin
      .from('assinaturas_manuais')
      .select('id, organizacao_id, plano_id, status, ciclo_cobranca, inicia_em, renova_em, proxima_cobranca_em, valor_centavos, observacoes')
      .in('status', ['ativa', 'pausada'])
      .order('atualizado_em', { ascending: false }),
  ])
  throwIfError(organizacoesError, cronError, acoesError, planosError, assinaturasError)

  const nomePlano = new Map((planos ?? []).map((p) => [p.id, p.nome]))
  const assinaturaPorOrganizacao = new Map<string, AssinaturaManualOperador>(
    (assinaturas ?? []).map((a) => [
      a.organizacao_id,
      {
        id: a.id,
        planoId: a.plano_id,
        plano: nomePlano.get(a.plano_id) ?? 'Plano removido',
        status: a.status as AssinaturaManualOperador['status'],
        cicloCobranca: a.ciclo_cobranca as AssinaturaManualOperador['cicloCobranca'],
        iniciaEm: a.inicia_em,
        renovaEm: a.renova_em,
        proximaCobrancaEm: a.proxima_cobranca_em,
        valorCentavos: a.valor_centavos,
        observacoes: a.observacoes,
      },
    ])
  )

  // Assentos e última atividade por organização: as duas colunas que decidem
  // se uma conta está viva. São N consultas, mas o universo aqui é o número
  // de clientes da plataforma, não de linhas de negócio.
  const porOrg = new Map<string, { assentos: number; ultimaAtividade: string | null }>()
  await Promise.all(
    (organizacoes ?? []).map(async (o) => {
      const [{ data: assentos }, { data: ultimo }] = await Promise.all([
        admin.rpc('assentos_ocupados', { p_org: o.id }),
        admin
          .from('apontamentos')
          .select('data')
          .eq('organizacao_id', o.id)
          .order('data', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      porOrg.set(o.id, { assentos: assentos ?? 0, ultimaAtividade: ultimo?.data ?? null })
    })
  )

  const ultimaPorTipo = new Map<string, string>()
  for (const e of cronExecucoes ?? []) {
    if (!ultimaPorTipo.has(e.tipo)) ultimaPorTipo.set(e.tipo, e.executado_em)
  }
  const saudeCrons = CRONS_DECLARADOS.map((c) => avaliarCron(c, ultimaPorTipo.get(c.tipo) ?? null))

  const envs = ENVS_ESPERADAS.map((e) => ({ ...e, presente: Boolean(process.env[e.nome]) }))

  const agora = agoraMs()
  const organizacoesDetalhadas = (organizacoes ?? []).map((o) => {
    const extra = porOrg.get(o.id)
    const ultimaAtividade = extra?.ultimaAtividade ?? null
    const diasSemAtividade = ultimaAtividade
      ? Math.floor((agora - new Date(ultimaAtividade).getTime()) / 86_400_000)
      : null
    return {
      id: o.id,
      nome: o.nome,
      slug: o.slug,
      status: o.status,
      planoId: o.plano_id,
      plano: nomePlano.get(o.plano_id) ?? '—',
      limiteAssentos: o.limite_assentos,
      assentosOcupados: extra?.assentos ?? 0,
      trialExpiraEm: o.trial_expira_em,
      excluirEm: o.excluir_em,
      criadoEm: o.criado_em,
      ultimaAtividade,
      diasSemAtividade,
      novaNoMes: agora - new Date(o.criado_em).getTime() < 30 * 86_400_000,
      // "Em risco" é o que merece uma ligação hoje: cortesia acabando, ou
      // conta que parou de ser usada. Sem este corte, o operador teria que
      // ler a lista inteira toda manhã para chegar na mesma conclusão.
      emRisco:
        (o.status === 'trialing' &&
          o.trial_expira_em !== null &&
          new Date(o.trial_expira_em).getTime() - agora < 3 * 86_400_000) ||
        ((o.status === 'ativa' || o.status === 'trialing') &&
          diasSemAtividade !== null &&
          diasSemAtividade >= DIAS_SEM_ATIVIDADE_PARA_RISCO),
      assinaturaManual: assinaturaPorOrganizacao.get(o.id) ?? null,
    }
  })

  const trilha = (acoes ?? []).map((a) => {
    const detalhes = a.detalhes as Record<string, unknown> | null
    return {
      id: a.id,
      acao: a.acao,
      organizacaoNome: a.organizacao_nome ?? (typeof detalhes?.planoNome === 'string' ? detalhes.planoNome : null),
      detalhes,
      criadoEm: a.criado_em,
    }
  })
  const catalogoPlanos = (planos ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    assentosInclusos: p.assentos_inclusos,
    precoMensalCentavos: p.preco_mensal_centavos,
    ativo: p.ativo,
    ordem: p.ordem,
  }))

  return (
    <ConsoleOperador
      organizacoes={organizacoesDetalhadas}
      planos={catalogoPlanos}
      crons={saudeCrons}
      envs={envs}
      trilha={trilha}
    />
  )
}
