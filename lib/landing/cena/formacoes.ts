import { TOTAL_ATOS, ATO } from '../atos'

/**
 * As formações: onde cada fragmento fica, e que tamanho tem, em cada ato.
 *
 * Tudo é pré-calculado uma vez e enviado à GPU como duas texturas de dados
 * (`n` colunas × 11 linhas). O shader lê o texel do ato atual e do próximo e
 * interpola — o filme inteiro vira um único float variando de 0 a 10, e nenhum
 * dado de posição volta para a CPU depois disso.
 *
 * É por isso que a cena é uma só, e não dez: os *mesmos* fragmentos ocupam
 * posições diferentes em cada ato. O cartão perdido no caos é o mesmo que vira
 * coluna do quadro e depois barra de capacidade.
 *
 * Canais:
 *   posicao[i, ato] = (x, y, z, meiaLargura)
 *   forma[i, ato]   = (meiaAltura, tinta, opacidade, solidez)
 *
 * Largura e altura vão em unidades de mundo, não como proporção: cada formação
 * declara o retângulo que quer, e nenhuma precisa converter razão em tamanho
 * para descobrir se um cartão cabe entre duas linhas da coluna.
 */

const TAU = Math.PI * 2
/** Metade do ângulo de construção da marca (62°, design.md §1). */
const MEIO_ANGULO = (31 * Math.PI) / 180

export const PAPEIS = ['cartao', 'no', 'barra', 'rotulo', 'marco'] as const
type Papel = (typeof PAPEIS)[number]

/** Proporção de cada papel no campo. `marco` fica em 8% porque é o único que
 *  recebe a cor de marca — é o "10% de acento" da identidade, em geometria. */
const MISTURA: Record<Papel, number> = { cartao: 0.3, no: 0.28, barra: 0.16, rotulo: 0.18, marco: 0.08 }

/** Tamanho ambiente de cada papel: [meia-largura, meia-altura] em unidades de
 *  mundo. É o que faz um fragmento ler como cartão, etiqueta ou avatar antes
 *  de existir qualquer texto. */
const TAMANHO: Record<Papel, readonly [number, number]> = {
  cartao: [0.2, 0.078],
  no: [0.038, 0.038],
  barra: [0.17, 0.013],
  rotulo: [0.088, 0.03],
  marco: [0.05, 0.05],
}

export type Campo = {
  n: number
  papel: Uint8Array
  /** Aleatório estável por fragmento (0–1): alimenta deriva, atraso e jitter. */
  semente: Float32Array
  /** Índice do fragmento dentro do próprio papel — permite dizer "o 3º cartão
   *  da 2ª coluna" sem procurar. */
  ordem: Uint16Array
  quantidade: Record<Papel, number>
  posicao: Float32Array
  forma: Float32Array
}

/** PRNG determinístico: a mesma cena em qualquer carregamento, e composição
 *  ajustável à mão sem virar sorteio a cada refresh. */
function prng(semente: number) {
  let a = semente >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function criarCampo(n: number): Campo {
  const r = prng(0x5645_5254)
  const papel = new Uint8Array(n)
  const semente = new Float32Array(n)
  const ordem = new Uint16Array(n)
  const quantidade: Record<Papel, number> = { cartao: 0, no: 0, barra: 0, rotulo: 0, marco: 0 }

  // Distribuição por fatia contígua, não por sorteio: sorteio deixa a
  // proporção real oscilar (e a cor de marca vazar dos 8%) a cada tamanho de
  // campo. Fatia garante a mistura exata em qualquer nível de dispositivo.
  let corte = 0
  const limites = PAPEIS.map((p) => (corte += MISTURA[p] * n))
  for (let i = 0; i < n; i++) {
    let p = 0
    while (p < PAPEIS.length - 1 && i >= limites[p]) p++
    papel[i] = p
    ordem[i] = quantidade[PAPEIS[p]]++
    semente[i] = r()
  }

  const posicao = new Float32Array(n * TOTAL_ATOS * 4)
  const forma = new Float32Array(n * TOTAL_ATOS * 4)
  const campo: Campo = { n, papel, semente, ordem, quantidade, posicao, forma }

  for (let ato = 0; ato < TOTAL_ATOS; ato++) montar(campo, ato, prng(0x9e37_79b9 + ato * 7919))
  return campo
}

/**
 * Presença da cena em cada ato: quanto o campo 3D pesa na composição.
 *
 * Nos atos em que a cena É a mensagem — o caos, a convergência, o vértice, o
 * fechamento — ela vale 1. Nos atos em que quem fala é o produto no DOM (o
 * quadro Kanban, o painel de capacidade, a cadeia de automação), o campo recua
 * para o papel de estrutura e profundidade.
 *
 * Sem este recuo o campo compete com o painel que ele deveria estar
 * emoldurando: retângulos grandes atravessando o texto, contorno de fragmento
 * brigando com contorno de cartão, e a impressão de duas interfaces sobrepostas
 * em vez de uma só com profundidade. Um número por ato resolve isso num lugar,
 * e a interpolação entre atos sai de graça — a opacidade viaja na textura e o
 * shader já mistura os dois atos vizinhos.
 */
const PRESENCA: Record<number, number> = {
  [ATO.DISPERSO]: 1,
  [ATO.ATRACAO]: 1,
  [ATO.CONVERGENCIA]: 1,
  [ATO.VERTICE]: 1,
  [ATO.QUADRO]: 0.3,
  [ATO.OPERACAO]: 0.3,
  [ATO.DADOS]: 0.72,
  [ATO.CAPACIDADE]: 0.3,
  [ATO.FLUXO]: 0.42,
  [ATO.ISOLAMENTO]: 0.5,
  [ATO.FINAL]: 1,
}

/** `solidez` 0 = só a aresta viva, 1 = preenchido. O tratamento de vidro que o
 *  símbolo pede: o vértice é o encontro de arestas, não um volume opaco. */
function escrever(
  c: Campo,
  i: number,
  ato: number,
  x: number,
  y: number,
  z: number,
  meiaL: number,
  meiaA: number,
  tinta: number,
  opacidade: number,
  solidez: number
) {
  const o = (ato * c.n + i) * 4
  c.posicao[o] = x
  c.posicao[o + 1] = y
  c.posicao[o + 2] = z
  c.posicao[o + 3] = meiaL
  c.forma[o] = meiaA
  c.forma[o + 1] = tinta
  c.forma[o + 2] = opacidade * (PRESENCA[ato] ?? 1)
  c.forma[o + 3] = solidez
}

/** Preenchimento padrão do papel: nó e marco são sólidos, superfícies são vidro. */
function solidezDe(p: Papel) {
  return p === 'no' || p === 'marco' ? 1 : 0.24
}

/**
 * Estacionamento: fragmento sem papel nesta cena recua para o fundo em vez de
 * sumir. Some, mas continua existindo — é o que sustenta a sensação de que a
 * cena é a mesma o tempo todo, e o que devolve as três camadas de profundidade
 * (frente, meio, fundo) sem inventar objeto novo.
 */
function recuar(c: Campo, i: number, ato: number, r: () => number, p: Papel) {
  const a = r() * TAU
  const raio = 6 + r() * 9
  const [l, h] = TAMANHO[p]
  escrever(
    c,
    i,
    ato,
    Math.cos(a) * raio * 1.25,
    Math.sin(a) * raio * 0.7,
    -9 - r() * 11,
    l * 0.85,
    h * 0.85,
    0,
    0.09 + r() * 0.13,
    solidezDe(p)
  )
}

function montar(c: Campo, ato: number, r: () => number) {
  switch (ato) {
    case ATO.DISPERSO:
      return disperso(c, r)
    case ATO.ATRACAO:
      return atracao(c, r)
    case ATO.CONVERGENCIA:
      return convergencia(c, r)
    case ATO.VERTICE:
      return vertice(c, r, ATO.VERTICE)
    case ATO.QUADRO:
      return quadro(c, r, false)
    case ATO.OPERACAO:
      return quadro(c, r, true)
    case ATO.DADOS:
      return dados(c, r)
    case ATO.CAPACIDADE:
      return capacidade(c, r)
    case ATO.FLUXO:
      return fluxo(c, r)
    case ATO.ISOLAMENTO:
      return isolamento(c, r)
    default:
      return vertice(c, r, ATO.FINAL)
  }
}

/* ── 0. Disperso ─────────────────────────────────────────────────────────────
   Anel elíptico com o miolo vazio. O vazio não é decorativo: é onde o H1 da
   hero é lido. Composição antes de efeito — o campo é construído em volta do
   texto, não por cima dele. */
function disperso(c: Campo, r: () => number) {
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const a = r() * TAU
    // Expoente < 1 empurra a densidade para fora, alargando o miolo limpo.
    const raio = 4.2 + Math.pow(r(), 0.55) * 8.6
    const z = -13 + r() * 16
    // Perto lê maior; longe, menor e mais apagado. A perspectiva já faria
    // parte disso — exagerá-la um pouco é o que separa as camadas.
    const prof = (z + 13) / 16
    const s = 0.72 + prof * 0.6
    escrever(
      c,
      i,
      ATO.DISPERSO,
      Math.cos(a) * raio * 1.2,
      Math.sin(a) * raio * 0.66,
      z,
      l * s,
      h * s,
      p === 'marco' ? 1 : 0,
      // Delicado não é invisível. Com aresta fina sobre fundo quase preto e
      // mistura aditiva, o campo da abertura estava inteiro presente no buffer
      // e ausente aos olhos — ele vive na periferia do quadro, que é
      // exatamente onde a vinheta mais escurece.
      0.5 + prof * 0.45,
      solidezDe(p)
    )
  }
}

/* ── 1. Atração ──────────────────────────────────────────────────────────────
   O mesmo campo contraído e parcialmente encaixado numa malha. Ninguém chegou
   ao centro ainda — o que muda é que as posições deixam de ser arbitrárias. É
   a cena em que se descobre que existe uma estrutura. */
function atracao(c: Campo, r: () => number) {
  const MALHA = 0.92
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const a = r() * TAU
    const raio = 2.6 + Math.pow(r(), 0.72) * 5.6
    const x = Math.cos(a) * raio * 1.15
    const y = Math.sin(a) * raio * 0.72
    // Encaixe parcial (55%): encaixe total mataria o caos cedo demais e
    // queimaria a virada do ato seguinte.
    const enc = 0.55
    const s = 0.9 + r() * 0.35
    escrever(
      c,
      i,
      ATO.ATRACAO,
      x + (Math.round(x / MALHA) * MALHA - x) * enc,
      y + (Math.round(y / MALHA) * MALHA - y) * enc,
      -8 + r() * 11,
      l * s,
      h * s,
      p === 'marco' ? 1 : 0,
      0.42 + r() * 0.45,
      solidezDe(p)
    )
  }
}

/* ── 2. Convergência ─────────────────────────────────────────────────────────
   Casca de Fibonacci: a distribuição mais uniforme que existe para pontos numa
   esfera. É a forma mais "precisa" possível de organizar o campo, e é isso que
   ela comunica — o caos virou sistema. */
function convergencia(c: Campo, r: () => number) {
  const AUREO = Math.PI * (1 + Math.sqrt(5))
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const k = (i + 0.5) / c.n
    const phi = Math.acos(1 - 2 * k)
    const theta = AUREO * i
    // Duas cascas concêntricas dão volume; uma só lê como bolha.
    const raio = i % 4 === 0 ? 2.55 : 4.5
    const s = Math.sin(phi)
    escrever(
      c,
      i,
      ATO.CONVERGENCIA,
      Math.cos(theta) * s * raio * 1.18,
      Math.sin(theta) * s * raio * 0.82,
      Math.cos(phi) * raio,
      l,
      h,
      p === 'marco' ? 1 : 0,
      0.5 + r() * 0.4,
      solidezDe(p)
    )
  }
}

/* ── 3 e 10. Vértice ─────────────────────────────────────────────────────────
   Duas superfícies descendentes que se encontram numa aresta, com um nó denso
   no ponto de encontro.

   NÃO é o símbolo redesenhado — design.md §8 proíbe reconstruir a marca com
   geometria, e o brief pede que ela seja reconhecida pelo comportamento, não
   pelo desenho. O que a estrutura empresta da identidade é o ângulo de
   construção (62°) e a ideia de duas arestas convergindo num ponto. Tem
   profundidade em z de propósito: é um volume atravessável, não uma letra. */
function vertice(c: Campo, r: () => number, ato: number) {
  const g = ato === ATO.VERTICE ? 1 : 1.22
  const APICE_Y = -2.5 * g
  const COMP = 6.1 * g
  const dir = [
    [-Math.sin(MEIO_ANGULO), Math.cos(MEIO_ANGULO)],
    [Math.sin(MEIO_ANGULO), Math.cos(MEIO_ANGULO)],
  ]

  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const sorte = r()

    // 12% formam o nó: o ponto onde a decisão acontece. Denso e luminoso.
    if (sorte > 0.88) {
      const a = r() * TAU
      const b = Math.acos(2 * r() - 1)
      const raio = Math.pow(r(), 0.5) * 0.46 * g
      const s = 0.052 * g
      escrever(
        c,
        i,
        ato,
        Math.sin(b) * Math.cos(a) * raio,
        APICE_Y + Math.sin(b) * Math.sin(a) * raio,
        Math.cos(b) * raio,
        s,
        s,
        1,
        1,
        1
      )
      continue
    }

    const [dx, dy] = dir[sorte > 0.44 ? 1 : 0]
    // Distribuição enviesada para a base: a densidade cresce onde as arestas
    // se encontram, e é a densidade que faz o olho achar o vértice sozinho.
    const s = Math.pow(r(), 1.35)
    const larg = (0.26 + s * 0.72) * g
    const u = (r() - 0.5) * larg
    const prof = (r() - 0.5) * 3.5 * g
    // A cor sobe perto do ápice, não uniformemente: o acento marca o ponto de
    // leitura, que é exatamente o papel dele na identidade.
    //
    // A queda é curta (0,22 do comprimento da aresta) porque a densidade dos
    // fragmentos já é enviesada para a base — com uma queda longa, "perto do
    // ápice" acabava valendo para um terço do campo inteiro e o acento deixava
    // de ser sinal para virar a cor da cena, contra design.md §0.7. O tamanho
    // continua crescendo numa faixa mais larga: volume perto do vértice é
    // desejável, cor espalhada não.
    const perto = 1 - Math.min(s / 0.22, 1)
    const esc = (0.85 + (1 - Math.min(s / 0.45, 1)) * 0.55) * g

    escrever(
      c,
      i,
      ato,
      dx * COMP * s + dy * u,
      APICE_Y + (dy * COMP * s - dx * u),
      prof,
      l * esc,
      h * esc,
      p === 'marco' ? 1 : perto * (ato === ATO.VERTICE ? 0.45 : 0.62),
      0.55 + (1 - Math.min(s / 0.45, 1)) * 0.45,
      p === 'no' || p === 'marco' ? 1 : 0.2 + perto * 0.32
    )
  }
}

/* ── 4 e 5. Quadro ───────────────────────────────────────────────────────────
   As mesmas peças assumem a estrutura de um Kanban: quatro colunas, planos de
   cartão empilhados, marcadores de responsável, etiqueta e progresso.

   O quadro legível é DOM (`quadro-vivo.tsx`) — texto dentro de canvas não é
   selecionável, não é lido por leitor de tela e não é indexado. Aqui fica o
   esqueleto espacial que monta o quadro e a profundidade em volta dele; o
   produto de verdade é desenhado por cima, nas mesmas colunas.

   `vivo` é o ato 5: o mesmo quadro depois de a operação acontecer — um cartão
   mudou de coluna, um progresso avançou. Delta pequeno de propósito: o sistema
   está trabalhando, não se refazendo. */
const COLUNAS = [-5.15, -1.72, 1.72, 5.15]
const QUADRO_TOPO = 2.5
const QUADRO_PASSO = 0.92
/** Menor que o cartão do DOM de propósito: o plano 3D é o lugar de onde o
 *  cartão legível emergiu, não uma segunda cópia dele disputando a leitura. */
const CARTAO: readonly [number, number] = [0.6, 0.22]

/** Em que coluna e linha cai o k-ésimo cartão, dada a ocupação das colunas. */
function assento(k: number, ocupacao: readonly number[]): [number, number] | null {
  let acc = 0
  for (let col = 0; col < ocupacao.length; col++) {
    if (k < acc + ocupacao[col]) return [col, k - acc]
    acc += ocupacao[col]
  }
  return null
}

function quadro(c: Campo, r: () => number, vivo: boolean) {
  const ato = vivo ? ATO.OPERACAO : ATO.QUADRO
  // Em `vivo`, um cartão saiu de "a fazer" e entrou em "em andamento", e o que
  // estava em aprovação foi concluído.
  const ocupacao = vivo ? [3, 5, 1, 3] : [4, 4, 2, 2]

  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const k = c.ordem[i]

    if (p === 'cartao') {
      const lugar = assento(k, ocupacao)
      if (!lugar) {
        recuar(c, i, ato, r, p)
        continue
      }
      const [col, linha] = lugar
      // Um só cartão destacado — o que acabou de se mover. Dois seriam
      // decoração; um é sinal.
      const destaque = vivo && col === 1 && linha === 0
      escrever(
        c,
        i,
        ato,
        COLUNAS[col],
        QUADRO_TOPO - linha * QUADRO_PASSO,
        (r() - 0.5) * 0.25,
        CARTAO[0],
        CARTAO[1],
        destaque ? 1 : 0,
        destaque ? 1 : 0.82,
        0.2
      )
      continue
    }

    if (p === 'barra') {
      if (k < 4) {
        // Cabeçalho da coluna.
        escrever(c, i, ato, COLUNAS[k], QUADRO_TOPO + 0.82, 0, 0.82, 0.026, 0, 0.5, 0.9)
      } else if (k < 8) {
        // Progresso dentro do primeiro cartão da coluna.
        const col = k - 4
        if (ocupacao[col] === 0) {
          recuar(c, i, ato, r, p)
          continue
        }
        const cheio = vivo && col === 1 ? 0.62 : 0.34
        escrever(
          c,
          i,
          ato,
          COLUNAS[col] - CARTAO[0] + 0.06 + cheio,
          QUADRO_TOPO - 0.17,
          0.12,
          cheio,
          0.018,
          vivo && col === 1 ? 1 : 0,
          0.9,
          1
        )
      } else {
        recuar(c, i, ato, r, p)
      }
      continue
    }

    if (p === 'no') {
      const lugar = assento(k, ocupacao)
      if (!lugar) {
        recuar(c, i, ato, r, p)
        continue
      }
      const [col, linha] = lugar
      // Avatar do responsável, canto inferior esquerdo do cartão.
      escrever(
        c,
        i,
        ato,
        COLUNAS[col] - CARTAO[0] + 0.14,
        QUADRO_TOPO - linha * QUADRO_PASSO - 0.16,
        0.14,
        0.055,
        0.055,
        0,
        0.95,
        1
      )
      continue
    }

    if (p === 'rotulo') {
      const lugar = assento(k, ocupacao)
      if (!lugar) {
        recuar(c, i, ato, r, p)
        continue
      }
      const [col, linha] = lugar
      // Etiqueta no topo do cartão.
      escrever(
        c,
        i,
        ato,
        COLUNAS[col] + CARTAO[0] - 0.24,
        QUADRO_TOPO - linha * QUADRO_PASSO + 0.16,
        0.14,
        0.17,
        0.038,
        col === 1 ? 0.85 : 0,
        0.8,
        1
      )
      continue
    }

    recuar(c, i, ato, r, p)
  }
}

/* ── 6. Dados ────────────────────────────────────────────────────────────────
   O quadro se desfaz e as mesmas peças caem numa dispersão com eixo. A leitura
   pretendida é causal, não decorativa: o gráfico não aparece ao lado da
   operação, ele *nasce* dela — tarefa vira ponto, ponto vira série. */
const HISTOGRAMA = [0.42, 0.55, 0.5, 0.68, 0.61, 0.74, 0.7, 0.82, 0.78, 0.88, 0.84, 0.95]
const DADOS_BASE_Y = -3.2

function dados(c: Campo, r: () => number) {
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const k = c.ordem[i]

    if (p === 'barra' && k < HISTOGRAMA.length) {
      const alt = HISTOGRAMA[k] * 3.1
      escrever(
        c,
        i,
        ATO.DADOS,
        -5.2 + k * 0.95,
        DADOS_BASE_Y + alt / 2,
        0,
        0.2,
        alt / 2,
        k === HISTOGRAMA.length - 1 ? 1 : 0,
        0.45 + (k / HISTOGRAMA.length) * 0.5,
        0.62
      )
      continue
    }

    if (p === 'no' || p === 'marco') {
      // Nuvem com correlação: cada ponto é um apontamento que aconteceu.
      const x = (r() - 0.5) * 11.4
      escrever(
        c,
        i,
        ATO.DADOS,
        x,
        0.4 + x * 0.34 + (r() - 0.5) * 2.5,
        (r() - 0.5) * 4.5,
        l * 1.05,
        h * 1.05,
        p === 'marco' ? 1 : 0,
        0.45 + r() * 0.5,
        1
      )
      continue
    }

    // Cartões e rótulos recuam e desbotam: a operação sai de foco enquanto o
    // dado que ela produziu entra.
    escrever(
      c,
      i,
      ATO.DADOS,
      (r() - 0.5) * 15,
      (r() - 0.5) * 8,
      -6 - r() * 8,
      l * 0.85,
      h * 0.85,
      0,
      0.1 + r() * 0.15,
      solidezDe(p)
    )
  }
}

/* ── 7. Capacidade ───────────────────────────────────────────────────────────
   Cinco pessoas, cinco barras, uma linha histórica. Os mesmos números da
   maquete do dashboard (128/104/92/87/46), para que a cena e o produto não
   contem histórias diferentes. */
const PESSOAS = [1.28, 1.04, 0.92, 0.87, 0.46]
const CAP_Y0 = 1.9
const CAP_PASSO = 0.82
// Deslocado para a direita: as barras ficam atrás do painel de capacidade do
// DOM, e não por cima da coluna de texto à esquerda.
const CAP_X0 = -1.9
const CAP_LARG = 6.2
const CAP_TETO = 1.3

function capacidade(c: Campo, r: () => number) {
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const k = c.ordem[i]

    if (p === 'barra' && k < PESSOAS.length) {
      const comp = CAP_LARG * (Math.min(PESSOAS[k], CAP_TETO) / CAP_TETO)
      // Só quem passou de 100% recebe cor. Sobrecarga é o dado que precisa saltar.
      escrever(c, i, ATO.CAPACIDADE, CAP_X0 + comp / 2, CAP_Y0 - k * CAP_PASSO, 0, comp / 2, 0.045, PESSOAS[k] > 1 ? 1 : 0, 0.95, 1)
      continue
    }

    if (p === 'no' && k < PESSOAS.length) {
      // Marcador da meta, no mesmo x para todas as pessoas — é a régua que
      // deixa a comparação acontecer sem número nenhum.
      escrever(c, i, ATO.CAPACIDADE, CAP_X0 + CAP_LARG / CAP_TETO, CAP_Y0 - k * CAP_PASSO, 0.1, 0.012, 0.1, 0, 0.55, 1)
      continue
    }

    if (p === 'marco' && k < 14) {
      // Linha histórica das últimas semanas, subindo à direita.
      const t = k / 13
      escrever(c, i, ATO.CAPACIDADE, -4.6 + t * 9.2, -2.5 + Math.pow(t, 0.75) * 1.55, 0.4, 0.05, 0.05, 1, 0.55 + t * 0.45, 1)
      continue
    }

    if (p === 'rotulo' && k < PESSOAS.length) {
      // Nome de cada pessoa, à esquerda da barra.
      escrever(c, i, ATO.CAPACIDADE, CAP_X0 - 1.3, CAP_Y0 - k * CAP_PASSO, 0, 0.42, 0.045, 0, 0.42, 0.3)
      continue
    }

    recuar(c, i, ATO.CAPACIDADE, r, p)
  }
}

/* ── 8. Fluxo ────────────────────────────────────────────────────────────────
   Seis núcleos em anel — cartão, regra, responsável, aprovação, calendário,
   relatório — com o campo agrupado em torno deles. Anel em 3D, e não fluxograma
   chapado: o sistema é um espaço, não um diagrama de processo corporativo. */
const NUCLEOS: readonly (readonly [number, number, number])[] = [
  [-5.6, 1.5, 1.2],
  [-2.1, 2.5, -1.6],
  [2.1, 2.1, 1.6],
  [5.6, 0.6, -1.2],
  [2.6, -2.2, 1.4],
  [-2.9, -2.4, -1.4],
]

function fluxo(c: Campo, r: () => number) {
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const k = c.ordem[i]

    // Um fragmento de cada papel-chave marca o núcleo em si.
    if (p === 'cartao' && k < NUCLEOS.length) {
      const [x, y, z] = NUCLEOS[k]
      escrever(c, i, ATO.FLUXO, x, y, z, 0.52, 0.2, k === 0 || k === 5 ? 1 : 0, 0.92, 0.22)
      continue
    }
    if (p === 'rotulo' && k < NUCLEOS.length) {
      const [x, y, z] = NUCLEOS[k]
      escrever(c, i, ATO.FLUXO, x, y + 0.3, z, 0.18, 0.036, 0, 0.7, 1)
      continue
    }

    // O resto orbita o núcleo mais próximo — satélites, não enfeite.
    const [ax, ay, az] = NUCLEOS[k % NUCLEOS.length]
    const a = r() * TAU
    const b = Math.acos(2 * r() - 1)
    const raio = 0.7 + Math.pow(r(), 0.6) * 1.45
    escrever(
      c,
      i,
      ATO.FLUXO,
      ax + Math.sin(b) * Math.cos(a) * raio,
      ay + Math.sin(b) * Math.sin(a) * raio * 0.8,
      az + Math.cos(b) * raio,
      l * 0.9,
      h * 0.9,
      p === 'marco' ? 1 : 0,
      0.3 + r() * 0.42,
      solidezDe(p)
    )
  }
}

/* ── 9. Isolamento ───────────────────────────────────────────────────────────
   Três células, três organizações. Nada atravessa a fronteira — não porque o
   movimento foi bloqueado, mas porque cada fragmento é gerado *dentro* da
   própria célula e não tem alvo do lado de fora. É a mesma garantia do
   produto: o isolamento é estrutural, não uma regra que alguém pode esquecer
   de aplicar. Nenhum cadeado, nenhum escudo — o espaço explica sozinho. */
export const CELULAS: readonly (readonly [number, number, number])[] = [
  [-5.6, 0, -1.2],
  [0, 0, 0.6],
  [5.6, 0, -1.2],
]
const MEIA_CELULA: readonly [number, number, number] = [2.05, 2.5, 1.5]

function isolamento(c: Campo, r: () => number) {
  const [hx, hy, hz] = MEIA_CELULA
  for (let i = 0; i < c.n; i++) {
    const p = PAPEIS[c.papel[i]]
    const [l, h] = TAMANHO[p]
    const k = c.ordem[i]
    const cel = i % CELULAS.length
    const [cx, cy, cz] = CELULAS[cel]

    // As paredes: 8 arestas por célula (retângulo da frente e o de trás). Os
    // fragmentos são planos voltados para a câmera, então uma aresta correndo
    // em z não teria como ser desenhada — a perspectiva entre os dois
    // retângulos já entrega o volume.
    if (p === 'barra' && k < CELULAS.length * 8) {
      const caixa = Math.floor(k / 8)
      const e = k % 8
      const [ex, ey, ez] = CELULAS[caixa]
      const face = e < 4 ? hz : -hz
      const lado = e % 4
      const vertical = lado < 2
      const sinal = lado % 2 === 0 ? -1 : 1
      escrever(
        c,
        i,
        ATO.ISOLAMENTO,
        ex + (vertical ? sinal * hx : 0),
        ey + (vertical ? 0 : sinal * hy),
        ez + face,
        vertical ? 0.01 : hx,
        vertical ? hy : 0.01,
        0,
        e < 4 ? 0.3 : 0.16,
        1
      )
      continue
    }

    // Conteúdo, sempre com folga da parede: encostar na fronteira sugeriria
    // que atravessar é uma possibilidade.
    const folga = 0.82
    escrever(
      c,
      i,
      ATO.ISOLAMENTO,
      cx + (r() - 0.5) * 2 * hx * folga,
      cy + (r() - 0.5) * 2 * hy * folga,
      cz + (r() - 0.5) * 2 * hz * folga,
      l * 0.9,
      h * 0.9,
      p === 'marco' && cel === 1 ? 1 : 0,
      0.3 + r() * 0.45,
      solidezDe(p)
    )
  }
}
