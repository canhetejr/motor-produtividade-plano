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
