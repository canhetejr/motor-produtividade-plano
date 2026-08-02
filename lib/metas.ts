/**
 * Resolução da meta aplicável a uma pessoa.
 *
 * Três níveis, do mais específico ao mais geral: meta da pessoa, meta da área
 * dela, e o padrão de 100% da carga horária. A precedência importa — definir
 * uma meta de área não pode sobrescrever o acerto individual feito com alguém.
 */

export const META_PADRAO = 1

export type Meta = {
  colaborador_id: string | null
  area_id: string | null
  alvo: number
  vigente_desde: string
}

export type OrigemMeta = 'colaborador' | 'area' | 'padrao'

export type MetaResolvida = {
  alvo: number
  origem: OrigemMeta
}

/**
 * `hoje` entra como parâmetro para o corte por vigência ser testável — uma meta
 * agendada para o mês que vem não pode valer agora.
 */
export function resolverMeta(
  metas: Meta[],
  colaboradorId: string,
  areaId: string | null,
  hoje: string
): MetaResolvida {
  const vigentes = metas.filter((m) => m.vigente_desde <= hoje)

  // Entre várias vigentes do mesmo escopo, vale a mais recente: é a última
  // decisão tomada, não a primeira.
  const maisRecente = (lista: Meta[]) =>
    lista.reduce<Meta | null>(
      (melhor, m) => (melhor === null || m.vigente_desde > melhor.vigente_desde ? m : melhor),
      null
    )

  const daPessoa = maisRecente(vigentes.filter((m) => m.colaborador_id === colaboradorId))
  if (daPessoa) return { alvo: daPessoa.alvo, origem: 'colaborador' }

  if (areaId) {
    const daArea = maisRecente(vigentes.filter((m) => m.area_id === areaId))
    if (daArea) return { alvo: daArea.alvo, origem: 'area' }
  }

  return { alvo: META_PADRAO, origem: 'padrao' }
}

/** Percentual de cumprimento da meta: 1.0 = bateu exatamente. */
export function cumprimento(indice: number, alvo: number): number {
  // Alvo zero não passa pelo check da tabela, mas defender aqui evita
  // Infinity chegar à tela se alguém alterar o dado por fora.
  if (alvo <= 0) return 0
  return indice / alvo
}

export function bateuMeta(indice: number, alvo: number): boolean {
  return cumprimento(indice, alvo) >= 1
}
