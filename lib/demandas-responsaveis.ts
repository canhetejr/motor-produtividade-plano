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
