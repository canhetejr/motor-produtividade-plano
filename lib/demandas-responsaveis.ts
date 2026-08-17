export type DemandaComArea = { id: string; areaId: string }
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

export function demandasPermitidasParaResponsaveis<T extends DemandaComArea>(
  demandas: T[],
  membros: ResponsavelComArea[],
  responsavelIds: string[]
): T[] {
  const areaId = areaComumDosResponsaveis(membros, responsavelIds)
  return areaId ? demandas.filter((demanda) => demanda.areaId === areaId) : []
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
  if (!areaComum) {
    return 'Os responsáveis são de áreas diferentes — escolha responsáveis da mesma área para vincular uma demanda.'
  }

  const temDemandaNaArea = demandas.some((demanda) => demanda.areaId === areaComum)
  if (!temDemandaNaArea) {
    return 'A área dos responsáveis ainda não tem demanda ativa cadastrada no Catálogo.'
  }

  return 'Sem demanda disponível.'
}
