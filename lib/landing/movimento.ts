/**
 * Sistema de movimento da landing — um lugar só para as constantes que a
 * narrativa inteira compartilha.
 *
 * Existe porque a experiência é uma timeline única atravessando dez cenas: se
 * cada componente escolhesse a própria duração, o próprio easing e a própria
 * intensidade de parallax, o resultado seria dez animações independentes em vez
 * de um filme.
 *
 * Só entra aqui o que é realmente consumido. Um token que ninguém usa não é
 * "previsão de necessidade futura", é documentação errada: quem for ajustar o
 * movimento mexe nele, não vê efeito nenhum e perde a confiança no arquivo. Foi
 * o que aconteceu com uma curva de câmera e uma de atração que existiam aqui
 * enquanto o comportamento real morava, respectivamente, num smoothstep dentro
 * de `cena.ts` e numa função do shader.
 */

/** Curva de entrada de conteúdo: chega rápido e desacelera. */
export const CURVA_ENTRADA = [0.16, 1, 0.3, 1] as const

/** Duração padrão da varredura que revela um bloco de texto, em segundos.
 *  Manchetes de momentos maiores passam valores próprios — é direção de arte
 *  por bloco, não uma escala reaproveitável. */
export const DURACAO_REVELACAO = 1.1

/**
 * Amortecimento, em unidades de "por segundo".
 *
 * A rolagem nativa é degrau: o navegador entrega saltos de dezenas de pixels.
 * Interpolar com estas constantes é o que transforma o degrau em movimento de
 * câmera. Valor alto = colado no dedo; baixo = flutuante demais.
 */
export const AMORTECIMENTO = {
  progresso: 7.5,
  ponteiro: 4.5,
  camera: 3.2,
} as const

/**
 * Influência do ponteiro.
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
 * 0 = todos se movem juntos (lê como interpolação de matriz).
 * 0.6 = os últimos só partem quando os primeiros já chegaram (lê como enxame).
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

/** Cores da cena, em componentes 0–1 de `#D7F75B` e do neutro do campo. */
export const CORES_CENA = {
  /** --tera-acid #D7F75B — o acento. Aparece em ~8% dos fragmentos. */
  acento: [0.843, 0.969, 0.357] as const,
  /** Neutro dos fragmentos comuns: quase branco, levemente frio. */
  neutro: [0.82, 0.83, 0.86] as const,
} as const
