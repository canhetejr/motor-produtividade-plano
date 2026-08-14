/**
 * Sistema de movimento da landing — um lugar só para as constantes que a
 * narrativa inteira compartilha.
 *
 * Existe porque a experiência é uma timeline única atravessando ~10 cenas: se
 * cada componente escolhesse a própria duração, o próprio easing e a própria
 * intensidade de parallax, o resultado seria dez animações independentes em vez
 * de um filme. Número mágico aqui é bug de continuidade, não questão de gosto.
 */

/** Curvas. Nomeadas pelo papel narrativo, não pelo formato matemático. */
export const CURVAS = {
  /** Entrada de conteúdo: chega rápido e desacelera. O padrão da casa. */
  entrada: [0.16, 1, 0.3, 1] as const,
  /** Saída de conteúdo: sai sem chamar atenção. */
  saida: [0.7, 0, 0.84, 0] as const,
  /** Deslocamento de câmera: acelera e desacelera com peso. */
  camera: [0.65, 0, 0.35, 1] as const,
  /** Atração ao vértice: começa devagar e ganha velocidade perto do alvo —
   *  é a curva que faz o campo parecer atraído por algo, e não interpolado. */
  atracao: [0.5, 0, 0.2, 1] as const,
  /** Micro-resposta ao ponteiro. */
  ponteiro: [0.25, 1, 0.5, 1] as const,
} as const

/** Durações em segundos. */
export const DURACAO = {
  micro: 0.18,
  curta: 0.32,
  media: 0.6,
  longa: 1.1,
  cena: 1.6,
} as const

/**
 * Amortecimento da rolagem, em unidades de "por segundo".
 *
 * A rolagem nativa é degrau: o navegador entrega saltos de dezenas de pixels.
 * Interpolar o progresso com esta constante é o que transforma o degrau em
 * movimento de câmera. Valor alto = colado no dedo; baixo = flutuante demais.
 * 7.5 foi onde a cena parou de parecer presa ao scroll sem começar a parecer
 * atrasada em relação ao texto que rola junto.
 */
export const AMORTECIMENTO = {
  progresso: 7.5,
  ponteiro: 4.5,
  camera: 3.2,
} as const

/**
 * Influência do ponteiro, por camada de profundidade.
 *
 * O que vende profundidade não é o parallax existir, é ele ser *desigual*: o
 * que está perto responde mais que o que está longe. Os valores são o
 * deslocamento máximo em unidades de mundo com o ponteiro no canto da tela.
 */
export const PONTEIRO = {
  /** Deslocamento máximo da câmera. Pequeno de propósito — a câmera sugere,
   *  não persegue o mouse. */
  camera: 0.42,
  /** Rotação máxima do rig, em radianos (≈ 2.3°). */
  rotacao: 0.04,
  /** Multiplicador aplicado no shader por instância, escalado pela
   *  profundidade de cada fragmento. */
  campo: 0.55,
  /** Raio (px) em que botões magnéticos começam a responder. */
  raioMagnetico: 110,
  /** Fração do deslocamento que o botão magnético acompanha. */
  forcaMagnetica: 0.28,
} as const

/**
 * Atraso de entrada por índice, em segundos. Usado quando o stagger é de
 * lista (DOM). No campo 3D o atraso é espacial, calculado no shader a partir
 * da distância ao alvo — lista não tem "distância", e é isso que diferencia
 * um stagger de template de um sistema emergindo.
 */
export const ESCALONAMENTO = {
  lista: 0.055,
  maximo: 0.44,
} as const

/**
 * Faixa em que os painéis do DOM revelam seus dados, medida no relógio
 * `visivel` do capítulo (0 = o bloco entra pela base da tela, 1 = sai pelo
 * topo).
 *
 * Fecha em 0,42 porque é aí que o bloco está confortavelmente enquadrado: um
 * contador que só chegasse ao valor final mais tarde terminaria de contar com o
 * painel já saindo, e quem lesse veria "0%" durante a tela inteira. O
 * escalonamento entre itens cabe dentro da janela, e não além dela.
 */
export const JANELA_DADOS = { inicio: 0.12, fim: 0.42, escalonamento: 0.025 } as const

/**
 * Fração da transição entre atos gasta esperando os fragmentos mais atrasados.
 *
 * 0 = todos os fragmentos se movem juntos (lê como interpolação de matriz).
 * 0.6 = os últimos só começam quando os primeiros já chegaram (lê como enxame).
 */
export const DISPERSAO_ATO = 0.42

/** Estados de câmera por ato. `alvo` é para onde ela olha; `pos` onde ela está. */
export type EstadoCamera = {
  pos: readonly [number, number, number]
  alvo: readonly [number, number, number]
  /** Campo de visão. Estreitar comprime a perspectiva e "achata" a cena —
   *  é o que faz o quadro Kanban ler como interface e não como maquete. */
  fov: number
}

export const NEVOA = { perto: 16, longe: 46 } as const

/** Cores da cena, em componentes 0–1 lineares de `#D7F75B` / `#9EB83C`. */
export const CORES_CENA = {
  /** --tera-acid #D7F75B — o acento. Aparece em ~8% dos fragmentos. */
  acento: [0.843, 0.969, 0.357] as const,
  /** --tera-acid-deep #9EB83C — acento em segundo plano. */
  acentoFundo: [0.62, 0.722, 0.235] as const,
  /** Neutro dos fragmentos comuns: quase branco, levemente frio. */
  neutro: [0.82, 0.83, 0.86] as const,
  /** Fundo da cena — combina com o `#05050b` do layout de marketing. */
  fundo: [0.02, 0.02, 0.043] as const,
} as const
