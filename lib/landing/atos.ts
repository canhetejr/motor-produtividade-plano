import type { EstadoCamera } from './movimento'

/**
 * A narrativa, em um lugar só.
 *
 * A página é uma timeline normalizada de 0 a 1. Cada ato ocupa uma faixa dessa
 * timeline e tem uma formação correspondente no campo 3D (`formacoes.ts`) e um
 * capítulo correspondente no DOM (`app/(marketing)/page.tsx`). Os três precisam
 * concordar: se a faixa daqui não bater com a altura da seção lá, o texto fala
 * de dados enquanto a cena ainda mostra o Kanban.
 *
 * Ordem narrativa (o ritmo importa tanto quanto as cenas):
 *   calma → curiosidade → movimento → convergência → silêncio →
 *   produto → dados → movimento → controle → conclusão
 */

export const ATO = {
  DISPERSO: 0,
  ATRACAO: 1,
  CONVERGENCIA: 2,
  VERTICE: 3,
  QUADRO: 4,
  OPERACAO: 5,
  DADOS: 6,
  CAPACIDADE: 7,
  FLUXO: 8,
  ISOLAMENTO: 9,
  FINAL: 10,
} as const

export type IndiceAto = (typeof ATO)[keyof typeof ATO]

export const TOTAL_ATOS = 11

type DefinicaoAto = {
  id: IndiceAto
  nome: string
  /** Início na timeline global (0–1). O fim é o início do ato seguinte. */
  inicio: number
  camera: EstadoCamera
  /** Quanto o campo respira parado nesta cena. 0 = imóvel, 1 = deriva plena.
   *  Cenas de "respiração" ficam baixas de propósito: sem contraste de
   *  intensidade, movimento constante vira ruído de fundo. */
  deriva: number
  /** Opacidade base das linhas de conexão desta formação. */
  linhas: number
  /** Se um pulso percorre as linhas (só onde significa "evento acontecendo"). */
  pulso: boolean
}

/**
 * As faixas seguem a referência do brief, ajustadas para a altura real das
 * seções: `VERTICE` e `ISOLAMENTO` são curtos porque são momentos de pausa —
 * uma frase e muito espaço —, e `OPERACAO` é longo porque é onde o produto
 * precisa ser lido, não só visto.
 */
export const ATOS: readonly DefinicaoAto[] = [
  {
    id: ATO.DISPERSO,
    nome: 'Disperso',
    inicio: 0,
    camera: { pos: [0, 0, 15.5], alvo: [0, 0, 0], fov: 46 },
    deriva: 1,
    linhas: 0,
    pulso: false,
  },
  {
    id: ATO.ATRACAO,
    nome: 'Atração',
    inicio: 0.085,
    camera: { pos: [0.6, 0.35, 13.4], alvo: [0, 0, -0.5], fov: 44 },
    deriva: 0.72,
    linhas: 0.3,
    pulso: false,
  },
  {
    id: ATO.CONVERGENCIA,
    nome: 'Convergência',
    inicio: 0.175,
    camera: { pos: [1.5, 0.8, 11.2], alvo: [0, 0, 0], fov: 42 },
    deriva: 0.4,
    linhas: 0.55,
    pulso: false,
  },
  {
    id: ATO.VERTICE,
    nome: 'Vértice',
    inicio: 0.26,
    camera: { pos: [0, -0.3, 9.6], alvo: [0, -0.35, 0], fov: 40 },
    // Quase imóvel: é o frame que precisa ser lembrado, e nada compete com ele.
    deriva: 0.12,
    linhas: 0.85,
    pulso: false,
  },
  {
    id: ATO.QUADRO,
    nome: 'Quadro',
    inicio: 0.335,
    // FOV estreito achata a perspectiva — o campo passa a ler como interface.
    camera: { pos: [0, 0.2, 12.8], alvo: [0, 0.1, 0], fov: 32 },
    deriva: 0.25,
    linhas: 0.22,
    pulso: false,
  },
  {
    id: ATO.OPERACAO,
    nome: 'Operação',
    inicio: 0.45,
    camera: { pos: [0.9, 0.1, 11.9], alvo: [0.2, 0, 0], fov: 32 },
    deriva: 0.34,
    linhas: 0.4,
    pulso: true,
  },
  {
    id: ATO.DADOS,
    nome: 'Dados',
    inicio: 0.565,
    camera: { pos: [0, 0.6, 13.2], alvo: [0, -0.4, 0], fov: 38 },
    deriva: 0.5,
    linhas: 0.3,
    pulso: false,
  },
  {
    id: ATO.CAPACIDADE,
    nome: 'Capacidade',
    inicio: 0.645,
    camera: { pos: [-0.8, 0.15, 11.4], alvo: [0, 0, 0], fov: 34 },
    deriva: 0.22,
    linhas: 0.35,
    pulso: false,
  },
  {
    id: ATO.FLUXO,
    nome: 'Fluxo',
    inicio: 0.735,
    camera: { pos: [0.4, 0.5, 12.2], alvo: [0, 0, -1], fov: 42 },
    deriva: 0.55,
    linhas: 0.8,
    pulso: true,
  },
  {
    id: ATO.ISOLAMENTO,
    nome: 'Isolamento',
    inicio: 0.835,
    camera: { pos: [0, 0, 13.6], alvo: [0, 0, -2], fov: 40 },
    deriva: 0.2,
    linhas: 0.25,
    pulso: false,
  },
  {
    id: ATO.FINAL,
    nome: 'Final',
    inicio: 0.905,
    camera: { pos: [0, -0.2, 9.2], alvo: [0, -0.3, 0], fov: 38 },
    deriva: 0.16,
    linhas: 0.9,
    pulso: false,
  },
]

/**
 * Altura do capítulo, em viewports.
 *
 * A cena não usa mais `inicio` para se localizar — quem manda são as seções
 * medidas por `motorRolagem`. O que `inicio` continua determinando é quanto
 * tempo de rolagem cada ato ganha, convertendo a faixa da timeline em altura
 * real. Um ato de respiração é curto porque tem pouco a dizer; a operação do
 * quadro é longa porque precisa ser lida, não só vista.
 *
 * O piso de 1 viewport não é estético: `motorRolagem` normaliza o progresso do
 * capítulo por `max(altura, viewport)`, então uma seção mais curta que a tela
 * nunca chegaria a 1 e o ato seguinte começaria antes do previsto.
 */
export function alturaDoAto(id: IndiceAto): number {
  const inicio = ATOS[id].inicio
  const fim = id + 1 < ATOS.length ? ATOS[id + 1].inicio : 1
  // Cada capítulo precisa ser mais alto que uma viewport, e por uma razão
  // mecânica: o conteúdo é `sticky top-0`, então a janela em que ele fica
  // realmente parado na tela é `altura - 1 viewport`. Com 1,1 viewport de
  // altura o texto mal encosta no topo antes de começar a subir de novo, e a
  // transformação da cena acontece com a tela já vazia. O piso de 1,7 garante
  // ao menos 0,7 de tela de permanência — tempo de ler enquanto a cena se
  // transforma atrás, que é o ponto da experiência inteira.
  const TOTAL_VIEWPORTS = 15
  return Math.max((fim - inicio) * TOTAL_VIEWPORTS, 1.7)
}
