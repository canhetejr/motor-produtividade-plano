import { TOTAL_ATOS, ATO } from '../atos'
import { PAPEIS, type Campo } from './formacoes'

/**
 * As arestas entre fragmentos.
 *
 * Uma linha só entra quando quer dizer alguma coisa: que existe uma estrutura
 * invisível organizando o campo (ato 1), que a operação dispara eventos entre
 * colunas (ato 5), que uma automação percorre um fluxo (ato 8) ou que o dado de
 * uma organização não sai da célula dela (ato 9). Linha sem significado é ruído
 * com aparência de tecnologia.
 *
 * As linhas não têm posição própria: o vertex shader lê a MESMA textura de
 * posição dos fragmentos, com o mesmo ato e o mesmo morph. Elas não podem
 * dessincronizar da geometria porque não existe uma segunda fonte de verdade.
 */

/** Teto por ato. Enviar tudo custaria pouco, mas ler tudo custaria a leitura. */
const MAX_PARES = 220

export type Conexoes = {
  /** Pares de índices de fragmento, por ato. */
  pares: Uint16Array[]
  maximo: number
}

function distancia2(p: Float32Array, base: number, a: number, b: number) {
  const ia = (base + a) * 4
  const ib = (base + b) * 4
  const dx = p[ia] - p[ib]
  const dy = p[ia + 1] - p[ib + 1]
  const dz = p[ia + 2] - p[ib + 2]
  return dx * dx + dy * dy + dz * dz
}

/**
 * Vizinhos dentro de um raio. Varredura direta em vez de estrutura espacial:
 * roda uma vez na montagem, com n ≤ 800, e uma grade de hash aqui seria
 * complexidade paga por um custo que não existe.
 *
 * `passo` amostra os fragmentos de origem — conectar todo mundo com todo mundo
 * produz uma teia opaca, não uma estrutura legível.
 */
function vizinhos(campo: Campo, ato: number, raio: number, passo: number, filtro?: (i: number) => boolean) {
  const base = ato * campo.n
  const r2 = raio * raio
  const out: number[] = []
  for (let i = 0; i < campo.n && out.length < MAX_PARES * 2; i += passo) {
    if (filtro && !filtro(i)) continue
    let melhor = -1
    let melhorD = r2
    for (let j = i + 1; j < campo.n; j++) {
      if (filtro && !filtro(j)) continue
      const d = distancia2(campo.posicao, base, i, j)
      if (d < melhorD) {
        melhorD = d
        melhor = j
      }
    }
    if (melhor >= 0) out.push(i, melhor)
  }
  return out
}

/** Índice do primeiro fragmento de um papel, para endereçar "o 3º cartão". */
function inicioDoPapel(campo: Campo, papel: (typeof PAPEIS)[number]) {
  const alvo = PAPEIS.indexOf(papel)
  for (let i = 0; i < campo.n; i++) if (campo.papel[i] === alvo) return i
  return 0
}

export function montarConexoes(campo: Campo): Conexoes {
  const pares: Uint16Array[] = new Array(TOTAL_ATOS)
  for (let a = 0; a < TOTAL_ATOS; a++) pares[a] = new Uint16Array(0)

  const cartao0 = inicioDoPapel(campo, 'cartao')
  const marco0 = inicioDoPapel(campo, 'marco')

  // Ato 1 — a estrutura se insinua: pares curtos e esparsos, nada fechado.
  pares[ATO.ATRACAO] = new Uint16Array(vizinhos(campo, ATO.ATRACAO, 1.9, 4))

  // Ato 2 — a casca ganha triangulação: a estrutura agora é evidente.
  pares[ATO.CONVERGENCIA] = new Uint16Array(vizinhos(campo, ATO.CONVERGENCIA, 1.7, 2))

  // Atos 3 e 10 — as duas arestas do vértice, desenhadas ao longo da direção
  // de convergência, e não entre vizinhos quaisquer.
  for (const ato of [ATO.VERTICE, ATO.FINAL] as const) {
    const base = ato * campo.n
    const esquerda: number[] = []
    const direita: number[] = []
    for (let i = 0; i < campo.n; i++) {
      const x = campo.posicao[(base + i) * 4]
      const y = campo.posicao[(base + i) * 4 + 1]
      if (y < -2.2) continue // o nó no ápice não entra na aresta
      ;(x < 0 ? esquerda : direita).push(i)
    }
    const ordenar = (lista: number[]) =>
      lista.sort((a, b) => campo.posicao[(base + a) * 4 + 1] - campo.posicao[(base + b) * 4 + 1])
    ordenar(esquerda)
    ordenar(direita)
    const out: number[] = []
    for (const lista of [esquerda, direita]) {
      // Passo maior que 1: a aresta é uma sugestão de linha, não um contorno
      // fechado. Contorno fecharia a forma e a transformaria em desenho.
      for (let i = 0; i + 3 < lista.length && out.length < MAX_PARES * 2; i += 3) out.push(lista[i], lista[i + 3])
    }
    pares[ato] = new Uint16Array(out)
  }

  // Ato 4 — o quadro montado: cada cartão ligado ao cabeçalho da coluna.
  {
    const barra0 = inicioDoPapel(campo, 'barra')
    const out: number[] = []
    const ocupacao = [4, 4, 2, 2]
    let k = 0
    for (let col = 0; col < 4; col++) {
      for (let l = 0; l < ocupacao[col]; l++) out.push(barra0 + col, cartao0 + k++)
    }
    pares[ATO.QUADRO] = new Uint16Array(out)
  }

  // Ato 5 — a operação: eventos entre cartões de colunas diferentes. São estes
  // pares que recebem o pulso, e é o pulso que faz o sistema parecer vivo.
  {
    const out: number[] = []
    const ligacoes: [number, number][] = [
      [0, 3],
      [3, 8],
      [4, 9],
      [1, 5],
      [8, 11],
      [2, 6],
    ]
    for (const [a, b] of ligacoes) out.push(cartao0 + a, cartao0 + b)
    pares[ATO.OPERACAO] = new Uint16Array(out)
  }

  // Ato 6 — a relação que a cena inteira existe para mostrar: cada ponto de
  // dado sobe da tarefa que o produziu.
  {
    const barra0 = inicioDoPapel(campo, 'barra')
    const base = ATO.DADOS * campo.n
    const out: number[] = []
    const noIdx = inicioDoPapel(campo, 'no')
    // Só a nuvem de pontos sobe até a barra. Varrer daqui até o fim do campo
    // incluía as próprias barras do histograma na origem da aresta, e quando o
    // índice varrido coincidia com a barra de destino a linha ligava um
    // fragmento a ele mesmo — geometria degenerada, invisível na tela e sem
    // significado nenhum na leitura ("esta tarefa produziu este dado" só vale
    // se a origem for uma tarefa).
    const fimDosNos = noIdx + campo.quantidade.no
    for (let i = noIdx; i < fimDosNos && out.length < 96; i += 5) {
      const x = campo.posicao[(base + i) * 4]
      const col = Math.max(0, Math.min(11, Math.round((x + 5.2) / 0.95)))
      out.push(i, barra0 + col)
    }
    pares[ATO.DADOS] = new Uint16Array(out)
  }

  // Ato 7 — a linha histórica ligada ponto a ponto: uma série, não pontos soltos.
  {
    const out: number[] = []
    for (let k = 0; k < 13; k++) out.push(marco0 + k, marco0 + k + 1)
    pares[ATO.CAPACIDADE] = new Uint16Array(out)
  }

  // Ato 8 — o fluxo: cartão → regra → responsável → aprovação → calendário →
  // relatório, mais os retornos que fecham o ciclo.
  {
    const out: number[] = []
    for (let k = 0; k < 6; k++) out.push(cartao0 + k, cartao0 + ((k + 1) % 6))
    out.push(cartao0 + 0, cartao0 + 3, cartao0 + 1, cartao0 + 4)
    pares[ATO.FLUXO] = new Uint16Array(out)
  }

  // Ato 9 — a prova visual do isolamento: só ligamos fragmentos da MESMA
  // célula. Nenhuma aresta cruza uma fronteira porque nenhuma existe para
  // cruzar. O filtro por `i % 3` é o eixo da organização, em geometria.
  {
    const out: number[] = []
    for (let cel = 0; cel < 3; cel++) {
      const p = vizinhos(campo, ATO.ISOLAMENTO, 1.5, 6, (i) => i % 3 === cel)
      for (const v of p) out.push(v)
    }
    pares[ATO.ISOLAMENTO] = new Uint16Array(out)
  }

  let maximo = 0
  for (const p of pares) maximo = Math.max(maximo, p.length / 2)
  return { pares, maximo }
}
