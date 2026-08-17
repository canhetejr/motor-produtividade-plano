export type DemandaComArea = {
  id: string
  areaId: string
  // Área em comum (areas.comum): esta demanda vale para responsável de
  // QUALQUER área, não só da área dela. Ausente/false = regra antiga.
  areaComum?: boolean
}
export type ResponsavelComArea = { id: string; areaId: string | null }

export function areaComumDosResponsaveis(
  membros: ResponsavelComArea[],
  responsavelIds: string[]
): string | null {
  if (responsavelIds.length === 0) return null

  const membroPorId = new Map(membros.map((membro) => [membro.id, membro]))
  let areaComum: string | null = null
  for (const id of responsavelIds) {
    const areaId = membroPorId.get(id)?.areaId
    if (!areaId) return null
    if (areaComum && areaComum !== areaId) return null
    areaComum = areaId
  }
  return areaComum
}

/**
 * Demanda de área comum libera qualquer responsável com área definida,
 * mesmo de áreas diferentes entre si — é o caso de mutirão/projeto entre
 * times. Fora isso, a regra antiga continua: todos os responsáveis
 * precisam ser da MESMA área, que precisa ser a área da demanda.
 */
export function demandasPermitidasParaResponsaveis<T extends DemandaComArea>(
  demandas: T[],
  membros: ResponsavelComArea[],
  responsavelIds: string[]
): T[] {
  if (responsavelIds.length === 0) return []

  const membroPorId = new Map(membros.map((membro) => [membro.id, membro]))
  if (responsavelIds.some((id) => !membroPorId.get(id)?.areaId)) return []

  const areaComum = areaComumDosResponsaveis(membros, responsavelIds)
  return demandas.filter((demanda) => demanda.areaComum || demanda.areaId === areaComum)
}

export function demandaPermitidaParaResponsaveis(
  demandaId: string,
  demandas: DemandaComArea[],
  membros: ResponsavelComArea[],
  responsavelIds: string[]
): boolean {
  if (!demandaId) return true
  return demandasPermitidasParaResponsaveis(demandas, membros, responsavelIds)
    .some((demanda) => demanda.id === demandaId)
}

/**
 * Por que o seletor de demanda está vazio — a lista de demandas disponíveis
 * já diz O QUE aconteceu (nada casou), mas não diz POR QUÊ. Sem isso, um
 * responsável sem área cadastrada ou uma área sem demanda ativa parecem a
 * mesma tela travada, e quem está usando não tem como se corrigir sozinho.
 */
export function motivoSemDemanda(
  demandas: DemandaComArea[],
  membros: ResponsavelComArea[],
  responsavelIds: string[]
): string {
  if (responsavelIds.length === 0) return 'Selecione um responsável para ver as demandas da área dele.'

  const membroPorId = new Map(membros.map((membro) => [membro.id, membro]))
  if (responsavelIds.some((id) => !membroPorId.get(id)?.areaId)) {
    return 'Um dos responsáveis não tem área definida — ajuste em Equipe e acessos.'
  }

  const areaComum = areaComumDosResponsaveis(membros, responsavelIds)
  const temDemandaComum = demandas.some((demanda) => demanda.areaComum)

  if (!areaComum && !temDemandaComum) {
    return 'Os responsáveis são de áreas diferentes — escolha responsáveis da mesma área, ou vincule uma demanda de uma área em comum.'
  }

  const temDemandaDisponivel = demandas.some((demanda) => demanda.areaComum || demanda.areaId === areaComum)
  if (!temDemandaDisponivel) {
    return 'A área dos responsáveis (e as áreas em comum) ainda não têm demanda ativa cadastrada no Catálogo.'
  }

  return 'Sem demanda disponível.'
}
