import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { agruparPorFaixa, hojeEmSaoPaulo } from '@/lib/semana'
import { SemanaLista } from './semana-lista'
import { GestorDemandas, type DemandaCatalogoSemana, type QuadroSemana } from './gestor-demandas'
import { carregarApontamento } from '../apontamento/carregar-apontamento'
import { PainelApontamento } from '../apontamento/painel-apontamento'
import { CorrecoesPainel } from '../apontamento/correcoes-painel'
import { listarCorrecoes } from '../apontamento/actions-correcoes'
import { CalendarDays } from 'lucide-react'
import { PageHeader, PageShell } from '@/components/layout/page-shell'

export const dynamic = 'force-dynamic'

/**
 * O hub do dia a dia: lançar o trabalho de hoje e ver o que vence.
 *
 * Era só a agenda por prazo — o lançamento morava em /apontamento, uma rota
 * separada que a pessoa tinha que lembrar de visitar. As duas respondiam
 * metade da mesma pergunta ("o que eu faço agora"), e nenhuma sozinha bastava
 * para começar o dia.
 *
 * O que NÃO foi absorvido, de propósito: histórico (/apontamento/historico) e
 * o formulário de lote em rota própria (/apontamento/lote) continuam
 * existindo. Editar e excluir lançamento é outra tarefa, e empilhá-la aqui
 * transformaria o hub numa tela de tudo.
 */
export default async function MinhaSemanaPage(props: {
  searchParams: Promise<{ modo?: string; date?: string }>
}) {
  const { user, profile } = await requireUser()
  const supabase = await createClient()
  const searchParams = await props.searchParams
  // Mesmo nome de parâmetro que /apontamento usava, para o redirect daquela
  // rota não precisar de tabela de tradução.
  const emLote = searchParams.modo === 'lote'

  // Um único nível: tudo depende só do id do usuário, que já veio do cookie.
  // A RLS restringe aos quadros de que a pessoa é membro; o filtro por
  // responsável é sobre isso.
  const cartoesPromise = supabase
    .from('cartoes')
    .select(
      'id, codigo, titulo, prazo, prioridade, colunas!inner(nome, quadro_id, etapa_final, quadros!inner(nome)), cartoes_responsaveis!inner(colaborador_id)'
    )
    .not('prazo', 'is', null)
    .eq('cartoes_responsaveis.colaborador_id', user.id)
    .order('prazo', { ascending: true })
    .limit(200)

  const quadrosPromise = profile.role === 'gestor'
    ? supabase
        .from('quadros')
        .select('id, nome, colunas(id, nome, posicao, etapa_final), quadros_membros(colaborador_id, colaboradores(nome, area_id, ativo))')
        .eq('ativo', true)
        .order('nome')
    : Promise.resolve({ data: null, error: null })

  // Filtro direto por organizacao_id: sem ele, o client de service role
  // traria para este processo os ids de conexão de todas as organizações.
  const conexoesPromise = profile.role === 'gestor'
    ? import('@/utils/supabase/admin')
        .then(({ createAdminClient }) =>
          createAdminClient()
            .from('google_workspace_conexoes')
            .select('colaborador_id')
            .eq('organizacao_id', profile.organizacao_id)
        )
        .then(({ data: conexoes }) => new Set((conexoes ?? []).map((conexao) => conexao.colaborador_id)))
        .catch(() => new Set<string>())
    : Promise.resolve(new Set<string>())

  const demandasPromise = profile.role === 'gestor'
    ? supabase.from('demandas').select('id, nome, area_id').eq('ativo', true).order('nome')
    : Promise.resolve({ data: null, error: null })

  const [
    { data, error },
    { data: quadros, error: quadrosError },
    googleIds,
    { data: demandasCatalogo, error: demandasError },
    dadosApontamento,
    correcoesRes,
  ] = await Promise.all([
    cartoesPromise,
    quadrosPromise,
    conexoesPromise,
    demandasPromise,
    carregarApontamento(profile, searchParams.date),
    listarCorrecoes(),
  ])

  let quadrosGestor: QuadroSemana[] = []
  let demandasGestor: DemandaCatalogoSemana[] = []
  if (profile.role === 'gestor') {
    if (quadrosError) {
      console.error('Falha ao carregar quadros para Minha semana: code=%s message=%s', quadrosError.code, quadrosError.message)
    } else {
      quadrosGestor = (quadros ?? []).map((quadro) => ({
        id: quadro.id,
        nome: quadro.nome,
        colunas: ((quadro.colunas as unknown as Array<{ id: string; nome: string; posicao: number; etapa_final: boolean }>) ?? [])
          .sort((a, b) => a.posicao - b.posicao)
          .map((coluna) => ({ id: coluna.id, nome: coluna.nome, posicao: coluna.posicao, etapaFinal: coluna.etapa_final })),
        membros: ((quadro.quadros_membros as unknown as Array<{ colaborador_id: string; colaboradores: { nome: string; area_id: string | null; ativo: boolean } | null }>) ?? [])
          .filter((membro) => membro.colaboradores?.ativo)
          .map((membro) => ({
            id: membro.colaborador_id,
            nome: membro.colaboradores?.nome ?? '—',
            areaId: membro.colaboradores?.area_id ?? null,
            googleConectado: googleIds.has(membro.colaborador_id),
          }))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      })).filter((quadro) => quadro.colunas.length > 0)
    }
    if (demandasError) {
      console.error('Falha ao carregar catálogo para Minha semana: code=%s message=%s', demandasError.code, demandasError.message)
    } else {
      demandasGestor = (demandasCatalogo ?? []).map((demanda) => ({
        id: demanda.id,
        nome: demanda.nome,
        areaId: demanda.area_id,
      }))
    }
  }

  if (error) {
    console.error('Falha ao carregar Minha semana: code=%s message=%s', error.code, error.message)
  }

  const cartoes = (data ?? []).map((c) => {
    // Embed !inner de um-para-um chega como objeto, mas o tipo gerado descreve
    // como array — normalizar aqui evita `any` espalhado.
    const coluna = Array.isArray(c.colunas) ? c.colunas[0] : c.colunas
    const quadro = Array.isArray(coluna?.quadros) ? coluna.quadros[0] : coluna?.quadros
    return {
      id: c.id,
      codigo: c.codigo ?? '',
      titulo: c.titulo,
      prazo: c.prazo as string,
      prioridade: c.prioridade,
      etapa: coluna?.nome ?? '',
      etapaFinal: Boolean(coluna?.etapa_final),
      quadroId: coluna?.quadro_id ?? '',
      quadroNome: quadro?.nome ?? '',
    }
  })

  // Card em etapa final já foi entregue; mantê-lo aqui transformaria a lista
  // num histórico, e a pergunta que ela responde é sobre o que ainda falta.
  const pendentes = cartoes.filter((c) => !c.etapaFinal)
  const faixas = agruparPorFaixa(pendentes)

  // A lista de correções é best-effort: uma falha ao carregá-la não pode
  // derrubar o lançamento nem a agenda, que são o motivo de a tela existir.
  const correcoes = correcoesRes.ok ? (correcoesRes.data ?? []) : []

  // O banco recusa `data >= current_date` (constraint
  // apontamentos_correcoes_data_passada). Ontem é o maior valor que o
  // formulário pode oferecer sem produzir um erro depois de tudo preenchido.
  const ontem = new Date(`${hojeEmSaoPaulo()}T12:00:00`)
  ontem.setDate(ontem.getDate() - 1)
  const ontemIso = ontem.toISOString().slice(0, 10)

  return (
    <PageShell contentClassName="space-y-8">
      <PageHeader
        title="Minha semana"
        description="Lance o trabalho de hoje e acompanhe o que vence, em todos os quadros."
        icon={CalendarDays}
        actions={profile.role === 'gestor' ? <GestorDemandas quadros={quadrosGestor} demandas={demandasGestor} /> : undefined}
      />

      {/* O que vence vem primeiro. O lançamento continua sendo o motivo de a
          pessoa abrir a tela todo dia, mas ele virou um botão — e a pergunta
          que sobra no topo é "o que eu faço agora", que é a lista de prazos. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Demandas da semana</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            O que vence e ainda não foi entregue, em todos os quadros.
          </p>
        </div>
        <SemanaLista faixas={faixas} total={pendentes.length} />
      </section>

      <PainelApontamento
        dados={dadosApontamento}
        usuarioId={user.id}
        cargaHorariaMin={profile.carga_horaria_min}
        role={profile.role}
        emLote={emLote}
        base="/minha-semana"
      />

      <CorrecoesPainel
        correcoes={correcoes}
        demandas={dadosApontamento.demandas.map((d) => ({ id: d.id, nome: d.nome }))}
        isGestor={profile.role === 'gestor'}
        ontemIso={ontemIso}
      />
    </PageShell>
  )
}
