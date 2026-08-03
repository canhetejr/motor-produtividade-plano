/**
 * Estado do tour de boas-vindas.
 *
 * Fica no armazenamento local, não no banco: não há sinal de "primeiro
 * acesso" em `colaboradores` (nem `criado_em` existe hoje), e criar uma
 * migração só para isso seria peso a mais numa decisão que é, na prática,
 * "essa pessoa já viu isto NESTE aparelho" — que é exatamente o que
 * localStorage responde sem tocar no banco.
 */

export const CHAVE_TOUR = 'vertice:tour-visto'

export type PassoTour = {
  titulo: string
  descricao: string
  href: string
}

export const PASSOS_TOUR: PassoTour[] = [
  {
    titulo: 'Registre seu tempo em segundos',
    descricao: 'Escolha a demanda e quanto fez — o Vértice calcula o resto. É a tela que abre toda vez que você entra.',
    href: '/apontamento',
  },
  {
    titulo: 'Acompanhe o trabalho em quadros',
    descricao: 'Cards, colunas e prazos. Arraste para mudar de etapa, ou abra um card para ver os detalhes.',
    href: '/kanban',
  },
  {
    titulo: 'Sua semana, de todos os quadros',
    descricao: 'O que tem prazo, o que está atrasado — reunido num lugar só, sem abrir quadro por quadro.',
    href: '/minha-semana',
  },
]

export function tourJaVisto(bruto: string | null): boolean {
  return bruto === '1'
}
