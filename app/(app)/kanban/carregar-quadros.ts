import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { throwIfError } from '@/lib/supabase-error'

export type QuadroComMembros = {
  id: string
  nome: string
  descricao: string | null
  codigo: string
  ativo: boolean
  membros: { colaborador_id: string; nome: string }[]
}

/**
 * Carrega os quadros de uma das duas listas — ativos ou arquivados — com os
 * membros de cada um.
 *
 * As duas rotas (/kanban e /kanban/arquivados) chamam daqui em vez de repetir
 * a consulta: elas precisam ser MUTUAMENTE EXCLUSIVAS, e duas cópias da mesma
 * query são dois lugares onde o filtro pode divergir sem que nada quebre — um
 * quadro arquivado aparecendo na lista principal não gera erro nenhum, só
 * confunde.
 *
 * O filtro por organização não aparece aqui porque é o client de sessão: a
 * política restritiva do eixo já amarra tudo a org_atual(). A visibilidade por
 * pessoa também é do banco — gestor vê todos os quadros, colaborador só os
 * vinculados (quadros_select_membro, 20260723010000_kanban.sql).
 */
export async function carregarQuadros(ativo: boolean): Promise<QuadroComMembros[]> {
  const supabase = await createClient()

  const { data: quadros, error: quadrosError } = await supabase
    .from('quadros')
    .select('*')
    .eq('ativo', ativo)
    .order('created_at', { ascending: false })
  throwIfError(quadrosError)

  const quadroIds = (quadros ?? []).map((q) => q.id)
  if (quadroIds.length === 0) return []

  const { data: membros, error: membrosError } = await supabase
    .from('quadros_membros')
    .select('quadro_id, colaborador_id, colaboradores(nome)')
    .in('quadro_id', quadroIds)
  throwIfError(membrosError)

  return (quadros ?? []).map((q) => ({
    ...q,
    membros: (membros ?? [])
      .filter((m) => m.quadro_id === q.id)
      .map((m) => ({
        colaborador_id: m.colaborador_id,
        nome: (m.colaboradores as { nome: string } | null)?.nome ?? '—',
      })),
  }))
}
