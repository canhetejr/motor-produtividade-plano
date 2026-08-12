import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Client = SupabaseClient<Database>

// Consultas puras, reusadas tanto pelas tools quanto pelos resources do MCP.
// Recebem sempre o client impersonado (utils/supabase/mcp.ts) — RLS já
// restringe o resultado ao colaborador dono do JWT, então o filtro por
// colaboradorId aqui é sobre a mensagem retornada, não segurança adicional.

export async function carregarPerfilMcp(supabase: Client, colaboradorId: string) {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id, nome, area_id, role, organizacao_id, carga_horaria_min')
    .eq('id', colaboradorId)
    .single()
  if (error || !data) {
    throw new Error(`Não foi possível carregar o perfil do colaborador: ${error?.message ?? 'não encontrado'}`)
  }
  return data
}

export async function listarApontamentos(
  supabase: Client,
  params: { colaboradorId: string; desde: string; ate: string }
) {
  const { data, error } = await supabase
    .from('apontamentos_calculado')
    .select('id, data, quantidade, tempo_total_min, demandas(nome)')
    .eq('colaborador_id', params.colaboradorId)
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

export async function listarDemandasMinhas(supabase: Client, params: { areaId: string | null }) {
  let query = supabase
    .from('demandas')
    .select('id, nome, variavel, tempo_padrao_min, blocos_totais, finita')
    .eq('ativo', true)
    .order('nome')
  if (params.areaId) query = query.eq('area_id', params.areaId)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar demandas: ${error.message}`)
  return data ?? []
}

export async function listarCartoesPendentes(supabase: Client, params: { colaboradorId: string }) {
  // Mesma base de app/(app)/minha-semana/page.tsx: cartão + coluna (para
  // saber se já é etapa final) + o join !inner que restringe a linha ao
  // responsável certo. "Pendente" aqui é "atribuído a mim e fora de etapa
  // final", mais amplo que Minha Semana (que só olha cartão com prazo).
  const { data, error } = await supabase
    .from('cartoes')
    .select(
      'id, codigo, titulo, prazo, prioridade, colunas!inner(nome, etapa_final, quadros!inner(nome)), cartoes_responsaveis!inner(colaborador_id)'
    )
    .eq('cartoes_responsaveis.colaborador_id', params.colaboradorId)
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
