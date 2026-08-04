import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'
import { somarSegundosSessoes } from '@/lib/tempo'
import { KanbanBoard } from './kanban-board'
import type { Cartao, CampoCustomizado, DemandaOpcao } from './types'

export const dynamic = 'force-dynamic'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

// Contadores da face do card. Cinco selects de ids em paralelo em vez de
// embeds aninhados: o embed de `cartoes` dentro de `cartoes` (subtarefa) é
// ambíguo no PostgREST, e agregar aqui mantém as cinco consultas simétricas.
async function carregarContadores(supabase: SupabaseServer, cartaoIds: string[]) {
  if (cartaoIds.length === 0) {
    return { subtarefas: [], anexos: [], checklist: [], aprovacoesPendentes: [], sessoes: [], sessoesSubtarefas: [] }
  }

  const [subtarefas, anexos, checklist, aprovacoesPendentes, sessoes] = await Promise.all([
    // `id` junto do pai: com ele dá pra somar o tempo das subtarefas sem uma
    // segunda ida ao banco (ver `tempoSubtarefasMin`).
    supabase.from('cartoes').select('id, cartao_pai_id').in('cartao_pai_id', cartaoIds),
    supabase.from('cartoes_anexos').select('cartao_id').in('cartao_id', cartaoIds),
    supabase.from('cartoes_checklist_itens').select('cartao_id, concluido').in('cartao_id', cartaoIds),
    supabase.from('cartoes_aprovacoes').select('cartao_id').in('cartao_id', cartaoIds).eq('status', 'PENDENTE'),
    supabase
      .from('cartoes_sessoes_tempo')
      .select('cartao_id, iniciado_em, finalizado_em, minutos')
      .in('cartao_id', cartaoIds)
      .not('finalizado_em', 'is', null),
  ])

  // Sessões das subtarefas: elas não estão em `cartaoIds` (o board carrega os
  // cards das colunas, e subtarefa também é card — mas a soma precisa cobrir
  // subtarefa de qualquer coluna, inclusive as que o filtro não trouxe).
  const subtarefaIds = (subtarefas.data ?? []).map((s) => s.id)
  const sessoesSubtarefas = subtarefaIds.length > 0
    ? await supabase
        .from('cartoes_sessoes_tempo')
        .select('cartao_id, iniciado_em, finalizado_em, minutos')
        .in('cartao_id', subtarefaIds)
        .not('finalizado_em', 'is', null)
    : { data: [] }

  return {
    subtarefas: subtarefas.data ?? [],
    anexos: anexos.data ?? [],
    checklist: checklist.data ?? [],
    aprovacoesPendentes: aprovacoesPendentes.data ?? [],
    sessoes: sessoes.data ?? [],
    sessoesSubtarefas: sessoesSubtarefas.data ?? [],
  }
}

export default async function QuadroPage({
  params,
  searchParams,
}: {
  params: Promise<{ quadroId: string }>
  searchParams: Promise<{ cartao?: string }>
}) {
  const { quadroId } = await params
  // `?cartao=<id>` abre o card direto — é o destino da variável
  // {{link_da_tarefa}} das automações. Lido aqui (e não com useSearchParams no
  // board) pra que servidor e cliente rendam o mesmo na primeira passada.
  const { cartao: cartaoInicial } = await searchParams
  const supabase = await createClient()

  // Tudo o que depende só de `quadroId` (ou de nada) vai num nível só. Antes
  // eram quatro round trips em série — sessão, quadro, o Promise.all e os
  // cartões — porque cada um esperava o anterior sem precisar:
  //
  //  - requireUser() e a query do quadro são independentes. Quem protege
  //    `quadros` é a RLS (quadros_select_membro) via cookie, não a ordem das
  //    chamadas; sem sessão a RLS devolve vazio e o notFound() abaixo cobre.
  //  - as oito consultas seguintes já chaveavam por `quadroId` (que vem de
  //    `params`) ou eram globais — nunca dependeram do resultado do quadro.
  //  - `cartoes` dependia de `colunaIds`. O embed `colunas!inner(quadro_id)`
  //    filtra pelo quadro direto no PostgREST, então a dependência some.
  const [
    { user, profile },
    { data: quadro, error: quadroError },
    { data: colunas, error: colunasError },
    { data: etiquetas, error: etiquetasError },
    { data: membros, error: membrosError },
    { data: formularios, error: formulariosError },
    { data: areas, error: areasError },
    { data: todosColaboradores, error: colaboradoresError },
    { data: camposCustomizados, error: camposError },
    { data: demandas, error: demandasError },
    { data: cartoes, error: cartoesError },
  ] = await Promise.all([
    requireUser(),
    supabase.from('quadros').select('*').eq('id', quadroId).maybeSingle(),
    supabase.from('colunas').select('*').eq('quadro_id', quadroId).order('posicao'),
    supabase.from('etiquetas').select('*').eq('quadro_id', quadroId).order('nome'),
    supabase.from('quadros_membros').select('colaborador_id, colaboradores(nome, avatar_url)').eq('quadro_id', quadroId),
    supabase.from('formularios').select('*, formularios_campos(*)').eq('quadro_id', quadroId).order('created_at'),
    supabase.from('areas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('colaboradores').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('quadros_campos').select('id, nome, tipo, opcoes, obrigatorio, posicao').eq('quadro_id', quadroId).order('posicao'),
    // Demandas ativas alimentam o seletor do card: é a ligação entre o tempo
    // cronometrado e o índice de produtividade (bloco 32).
    supabase.from('demandas').select('id, area_id, nome, tempo_padrao_min, blocos_totais, finita, variavel, areas(nome)').eq('ativo', true).order('nome'),
    supabase
      .from('cartoes')
      .select('*, cartoes_responsaveis(colaborador_id), cartoes_etiquetas(etiqueta_id), colunas!inner(quadro_id)')
      .eq('colunas.quadro_id', quadroId)
      .order('posicao'),
  ])

  // RLS (quadros_select_membro) já barra quem não é gestor nem membro — aqui
  // só distinguimos "não existe" de "existe mas RLS escondeu" pra decidir
  // entre notFound (ambos os casos, do ponto de vista do usuário, dão 404).
  throwIfError(quadroError)
  if (!quadro) notFound()
  throwIfError(colunasError, etiquetasError, membrosError, formulariosError, areasError, colaboradoresError, camposError, demandasError)
  throwIfError(cartoesError)

  // Contadores da face do card. Cinco selects de ids em paralelo em vez de
  // embeds aninhados: o embed de `cartoes` em `cartoes` (subtarefa) é ambíguo
  // no PostgREST, e agregar aqui mantém as cinco consultas simétricas.
  const cartaoIds = (cartoes ?? []).map((c) => c.id)
  const agregados = await carregarContadores(supabase, cartaoIds)
  const { subtarefas, anexos, checklist, aprovacoesPendentes, sessoes, sessoesSubtarefas } = agregados

  const contarPor = <T,>(linhas: T[] | null, chave: (l: T) => string | null) => {
    const mapa = new Map<string, number>()
    for (const linha of linhas ?? []) {
      const id = chave(linha)
      if (id) mapa.set(id, (mapa.get(id) ?? 0) + 1)
    }
    return mapa
  }

  const totalSubtarefas = contarPor(subtarefas, (s) => s.cartao_pai_id)
  const totalAnexos = contarPor(anexos, (a) => a.cartao_id)
  const totalAprovacoesPendentes = contarPor(aprovacoesPendentes, (a) => a.cartao_id)

  const checklistPorCartao = new Map<string, { total: number; concluidos: number }>()
  for (const item of checklist ?? []) {
    const atual = checklistPorCartao.get(item.cartao_id) ?? { total: 0, concluidos: 0 }
    atual.total += 1
    if (item.concluido) atual.concluidos += 1
    checklistPorCartao.set(item.cartao_id, atual)
  }

  const sessoesPorCartao = new Map<string, { iniciadoEm: string; finalizadoEm: string | null; minutos: number | null }[]>()
  for (const s of sessoes ?? []) {
    const lista = sessoesPorCartao.get(s.cartao_id) ?? []
    lista.push({ iniciadoEm: s.iniciado_em, finalizadoEm: s.finalizado_em, minutos: s.minutos })
    sessoesPorCartao.set(s.cartao_id, lista)
  }

  // Tempo das subtarefas somado no pai: as sessões vêm por subtarefa, então
  // reagrupa por `cartao_pai_id` antes de somar.
  const paiPorSubtarefa = new Map((subtarefas ?? []).map((s) => [s.id, s.cartao_pai_id]))
  const sessoesPorPai = new Map<string, { iniciadoEm: string; finalizadoEm: string | null; minutos: number | null }[]>()
  for (const s of sessoesSubtarefas ?? []) {
    const paiId = paiPorSubtarefa.get(s.cartao_id)
    if (!paiId) continue
    const lista = sessoesPorPai.get(paiId) ?? []
    lista.push({ iniciadoEm: s.iniciado_em, finalizadoEm: s.finalizado_em, minutos: s.minutos })
    sessoesPorPai.set(paiId, lista)
  }

  const colunasFormatadas = (colunas ?? []).map((c) => ({
    id: c.id,
    quadro_id: c.quadro_id,
    nome: c.nome,
    posicao: c.posicao,
    etapaFinal: c.etapa_final,
    limiteWip: c.limite_wip,
    slaHoras: c.sla_horas,
  }))

  // O vínculo de demanda existente no produto é pela área do colaborador.
  // Além de não poluir o seletor, esse mesmo limite é validado na action.
  const demandasFormatadas: DemandaOpcao[] = (demandas ?? [])
    .filter((d) => profile.role === 'gestor' || d.area_id === profile.area_id)
    .map((d) => ({
    id: d.id,
    nome: d.nome,
    areaNome: (d.areas as unknown as { nome: string } | null)?.nome ?? '—',
    tempoPadraoMin: d.tempo_padrao_min,
    blocosTotais: d.blocos_totais,
    finita: d.finita,
    variavel: d.variavel,
    }))

  const membrosQuadro = (membros ?? []).map((m) => {
    const colaborador = m.colaboradores as { nome: string; avatar_url: string | null } | null
    return {
      id: m.colaborador_id,
      nome: colaborador?.nome ?? '—',
      avatarUrl: colaborador?.avatar_url ?? null,
    }
  })

  const membrosQuadroIds = new Set(membrosQuadro.map((m) => m.id))
  const membrosNaoAutorizados = (todosColaboradores ?? [])
    .filter((c) => !membrosQuadroIds.has(c.id))
    .map((c) => ({ id: c.id, nome: c.nome }))

  const cartoesFormatados = (cartoes ?? []).map((c) => ({
    id: c.id,
    coluna_id: c.coluna_id,
    titulo: c.titulo,
    descricao: c.descricao,
    posicao: c.posicao,
    prioridade: c.prioridade,
    prazo: c.prazo,
    codigo: c.codigo,
    responsaveis: (c.cartoes_responsaveis ?? []).map((r: { colaborador_id: string }) => r.colaborador_id),
    etiquetas: (c.cartoes_etiquetas ?? []).map((e: { etiqueta_id: string }) => e.etiqueta_id),
    tipo: c.tipo,
    cartaoPaiId: c.cartao_pai_id,
    inicioDesejado: c.inicio_desejado,
    entregueEm: c.entregue_em,
    tempoEstimadoMin: c.tempo_estimado_min,
    centroId: c.centro_id,
    demandaId: c.demanda_id,
    tagReferencia: c.tag_referencia,
    recorrencia: c.recorrencia as Cartao['recorrencia'],
    totalSubtarefas: totalSubtarefas.get(c.id) ?? 0,
    totalAnexos: totalAnexos.get(c.id) ?? 0,
    checklist: checklistPorCartao.get(c.id) ?? { total: 0, concluidos: 0 },
    temAprovacaoPendente: (totalAprovacoesPendentes.get(c.id) ?? 0) > 0,
    tempoRegistradoMin: Math.round(somarSegundosSessoes(sessoesPorCartao.get(c.id) ?? []) / 60),
    tempoSubtarefasMin: Math.round(somarSegundosSessoes(sessoesPorPai.get(c.id) ?? []) / 60),
    etapaDesde: c.etapa_desde,
  }))

  const formulariosFormatados = (formularios ?? []).map((f) => ({
    id: f.id,
    coluna_id: f.coluna_id,
    titulo: f.titulo,
    descricao: f.descricao,
    slug: f.slug,
    ativo: f.ativo,
    cor_tema: f.cor_tema,
    mensagem_sucesso: f.mensagem_sucesso,
    mostrar_marca: f.mostrar_marca,
    titulo_template: f.titulo_template,
    descricao_template: f.descricao_template,
    campos: (f.formularios_campos ?? [])
      .slice()
      .sort((a, b) => a.posicao - b.posicao)
      .map((c) => ({
        id: c.id,
        rotulo: c.rotulo,
        tipo: c.tipo,
        placeholder: c.placeholder ?? '',
        obrigatorio: c.obrigatorio,
        opcoes: c.opcoes,
        mapeado_para: c.mapeado_para,
      })),
  }))

  return (
    <KanbanBoard
      quadro={quadro}
      colunasIniciais={colunasFormatadas}
      cartoesIniciais={cartoesFormatados}
      etiquetasIniciais={etiquetas ?? []}
      membrosQuadro={membrosQuadro}
      membrosNaoAutorizados={membrosNaoAutorizados}
      areas={areas ?? []}
      formulariosIniciais={formulariosFormatados}
      currentUserId={user.id}
      isGestor={profile.role === 'gestor'}
      camposCustomizados={(camposCustomizados ?? []) as CampoCustomizado[]}
      demandas={demandasFormatadas}
      cartaoInicial={cartaoInicial ?? null}
    />
  )
}
