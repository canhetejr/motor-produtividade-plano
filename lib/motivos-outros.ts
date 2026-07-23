// Motivos fixos para lançamentos de tempo variável ("Outros") — dá
// visibilidade ao gestor sobre pra onde está indo o tempo não padronizado,
// sem virar um catálogo gerenciável (se um motivo aparecer demais, o caminho
// natural é virar demanda própria via solicitacoes_demandas).
export const MOTIVOS_OUTROS = [
  'Reunião',
  'Treinamento',
  'Suporte a colega',
  'Retrabalho',
  'Imprevisto',
  'Outro',
] as const

export type MotivoOutros = (typeof MOTIVOS_OUTROS)[number]
