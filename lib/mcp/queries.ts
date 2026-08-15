import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

// Consultas do servidor MCP, reusadas tanto pelas tools quanto pelos
// resources. Sem sessão de usuário (não há JWT de impersonação — ver
// lib/mcp-auth.ts), então cada função aqui cria seu próprio client de
// service role e filtra EXPLICITAMENTE por organizacao_id (e por
// colaborador_id/area_id quando o dado é pessoal). `identidade` vem sempre
// do McpSessao já resolvido e validado por lib/mcp-auth.ts::resolverMcpToken
// — nunca de um parâmetro de entrada da tool. Este arquivo é o único, além
// de lib/mcp-auth.ts, que importa createAdminClient no fluxo MCP —
// allowlisted em __tests__/isolamento/admin-client-estatico.test.ts.

type Identidade = { colaboradorId: string; organizacaoId: string }

export async function carregarPerfilMcp(identidade: Identidade) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('colaboradores')
    .select('id, nome, area_id, role, organizacao_id, carga_horaria_min')
    .eq('id', identidade.colaboradorId)
    .eq('organizacao_id', identidade.organizacaoId)
    .single()
  if (error || !data) {
    throw new Error(`Não foi possível carregar o perfil do colaborador: ${error?.message ?? 'não encontrado'}`)
  }
  return data
}

export async function listarApontamentos(identidade: Identidade, params: { desde: string; ate: string }) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('apontamentos_calculado')
    .select('id, data, quantidade, tempo_total_min, demandas(nome)')
    .eq('colaborador_id', identidade.colaboradorId)
    .eq('organizacao_id', identidade.organizacaoId)
    .gte('data', params.desde)
    .lte('data', params.ate)
    .order('data', { ascending: false })
    .limit(500)
  if (error) throw new Error(`Falha ao listar apontamentos: ${error.message}`)
  return (data ?? []).map((a) => ({
    id: a.id,
    data: a.data,
    quantidade: a.quantidade,
    tempoTotalMin: a.tempo_total_min,
    demanda: (a.demandas as unknown as { nome: string } | null)?.nome ?? null,
  }))
}

export async function listarDemandasMinhas(identidade: Identidade, params: { areaId: string | null }) {
  const admin = createAdminClient()
  let query = admin
    .from('demandas')
    .select('id, nome, variavel, tempo_padrao_min, blocos_totais, finita')
    .eq('organizacao_id', identidade.organizacaoId)
    .eq('ativo', true)
    .order('nome')
  if (params.areaId) query = query.eq('area_id', params.areaId)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar demandas: ${error.message}`)
  return data ?? []
}

/**
 * Quadros que o colaborador alcança, com as colunas de cada um.
 *
 * Existe porque as tools de escrita do kanban recebem `coluna_id`, e sem esta
 * leitura o agente não teria de onde tirar um id válido — pediria ao usuário
 * para colar UUID, ou pior, tentaria adivinhar.
 *
 * Mesma regra de `pode_acessar_quadro`/`is_quadro_membro` (gestor da
 * organização OU membro do quadro), resolvida em duas consultas em vez de uma
 * chamada de RPC por quadro.
 */
export async function listarQuadrosAcessiveis(identidade: Identidade) {
  const admin = createAdminClient()
  const perfil = await carregarPerfilMcp(identidade)

  let query = admin
    .from('quadros')
    .select('id, nome, codigo, colunas(id, nome, posicao, etapa_final)')
    .eq('organizacao_id', identidade.organizacaoId)
    .eq('ativo', true)
    .order('nome')

  if (perfil.role !== 'gestor') {
    const { data: membros, error: erroMembros } = await admin
      .from('quadros_membros')
      .select('quadro_id')
      .eq('colaborador_id', identidade.colaboradorId)
      .eq('organizacao_id', identidade.organizacaoId)
    if (erroMembros) throw new Error(`Falha ao listar quadros: ${erroMembros.message}`)

    const ids = (membros ?? []).map((m) => m.quadro_id)
    if (ids.length === 0) return []
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar quadros: ${error.message}`)

  return (data ?? []).map((q) => ({
    id: q.id,
    nome: q.nome,
    codigo: q.codigo,
    colunas: ((q.colunas as unknown as { id: string; nome: string; posicao: number; etapa_final: boolean }[]) ?? [])
      .slice()
      .sort((a, b) => a.posicao - b.posicao)
      .map((c) => ({ id: c.id, nome: c.nome, etapaFinal: c.etapa_final })),
  }))
}

/**
 * Detalhe de um cartão, para o agente ter contexto antes de mover ou comentar.
 *
 * `organizacao_id` filtra a tabela raiz e a checagem de quadro fica a cargo de
 * quem chama (lib/mcp/tools/kanban.ts) — mesma dupla de filtros das escritas.
 */
export async function detalharCartao(identidade: Identidade, cartaoId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cartoes')
    // Uma string literal só: a inferência de tipos do PostgREST lê o texto do
    // select em tempo de compilação, e concatenar com `+` a transforma em
    // `string` — o retorno vira GenericStringError e todo campo some.
    .select('id, codigo, titulo, descricao, prioridade, prazo, entregue_em, coluna_id, colunas!inner(id, nome, etapa_final, quadro_id, quadros!inner(id, nome)), cartoes_responsaveis(colaboradores(id, nome))')
    .eq('id', cartaoId)
    .eq('organizacao_id', identidade.organizacaoId)
    .maybeSingle()
  if (error) throw new Error(`Falha ao carregar o cartão: ${error.message}`)
  if (!data) return null

  const coluna = data.colunas as unknown as {
    id: string
    nome: string
    etapa_final: boolean
    quadro_id: string
    quadros: { id: string; nome: string } | null
  }
  const responsaveis = (data.cartoes_responsaveis as unknown as { colaboradores: { id: string; nome: string } | null }[]) ?? []

  return {
    id: data.id,
    codigo: data.codigo,
    titulo: data.titulo,
    descricao: data.descricao,
    prioridade: data.prioridade,
    prazo: data.prazo,
    entregue: Boolean(data.entregue_em),
    coluna: { id: coluna.id, nome: coluna.nome, etapaFinal: coluna.etapa_final },
    quadro: { id: coluna.quadro_id, nome: coluna.quadros?.nome ?? null },
    responsaveis: responsaveis.map((r) => r.colaboradores?.nome).filter(Boolean),
  }
}

export async function listarCartoesPendentes(identidade: Identidade) {
  const admin = createAdminClient()
  // Mesma base de app/(app)/minha-semana/page.tsx: cartão + coluna (para
  // saber se já é etapa final) + o join !inner que restringe a linha ao
  // responsável certo. "Pendente" aqui é "atribuído a mim e fora de etapa
  // final", mais amplo que Minha Semana (que só olha cartão com prazo).
  // organizacao_id filtra a tabela raiz (cartoes) — sem RLS, é o que
  // impede o service role de devolver cartão de outra organização mesmo
  // que colaborador_id, por algum erro de dado, apontasse para lá.
  const { data, error } = await admin
    .from('cartoes')
    .select(
      'id, codigo, titulo, prazo, prioridade, colunas!inner(nome, etapa_final, quadros!inner(nome)), cartoes_responsaveis!inner(colaborador_id)'
    )
    .eq('organizacao_id', identidade.organizacaoId)
    .eq('cartoes_responsaveis.colaborador_id', identidade.colaboradorId)
    .eq('colunas.etapa_final', false)
    .order('prazo', { ascending: true, nullsFirst: false })
    .limit(200)
  if (error) throw new Error(`Falha ao listar cartões pendentes: ${error.message}`)
  return (data ?? []).map((c) => {
    const coluna = c.colunas as unknown as {
      nome: string
      etapa_final: boolean
      quadros: { nome: string } | null
    } | null
    return {
      id: c.id,
      codigo: c.codigo,
      titulo: c.titulo,
      prazo: c.prazo,
      prioridade: c.prioridade,
      coluna: coluna?.nome ?? null,
      quadro: coluna?.quadros?.nome ?? null,
    }
  })
}
