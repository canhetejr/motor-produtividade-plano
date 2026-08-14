import { describe, it, expect } from 'vitest'

import { ATOS, ATO, TOTAL_ATOS, alturaDoAto, type IndiceAto } from './atos'
import { moldar } from './rolagem'
import { rebaixar, CAPACIDADE_INICIAL, type Capacidade } from './dispositivo'
import { CELULAS, criarCampo, PAPEIS } from './cena/formacoes'
import { montarConexoes } from './cena/conexoes'

// A cena da landing é toda função pura: as onze formações, as conexões e as
// curvas de tempo são calculadas antes de qualquer pixel existir. Isso é o que
// permite testar aqui, em Node puro, invariantes que de outra forma só
// apareceriam como defeito visual — e defeito visual em página de marketing é o
// tipo de coisa que ninguém percebe até um cliente perceber.

const CAMPO = criarCampo(760)
const CONEXOES = montarConexoes(CAMPO)

/** Lê o fragmento `i` no ato `ato`, já com os canais nomeados. */
function fragmento(i: number, ato: number) {
  const o = (ato * CAMPO.n + i) * 4
  return {
    x: CAMPO.posicao[o],
    y: CAMPO.posicao[o + 1],
    z: CAMPO.posicao[o + 2],
    meiaLargura: CAMPO.posicao[o + 3],
    meiaAltura: CAMPO.forma[o],
    tinta: CAMPO.forma[o + 1],
    opacidade: CAMPO.forma[o + 2],
    solidez: CAMPO.forma[o + 3],
  }
}

describe('curva de permanência da cena', () => {
  it('segura a formação no começo e a entrega antes do fim do capítulo', () => {
    // A espera é o que dá tempo de ler; terminar antes de 1 é o que faz a
    // formação seguinte já estar montada quando o próximo capítulo começa.
    expect(moldar(0)).toBe(0)
    expect(moldar(0.1)).toBe(0)
    expect(moldar(0.72)).toBe(1)
    expect(moldar(1)).toBe(1)
  })

  it('é monotônica — a cena nunca anda para trás enquanto a rolagem avança', () => {
    let anterior = -1
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const v = moldar(t)
      expect(v).toBeGreaterThanOrEqual(anterior)
      anterior = v
    }
  })
})

describe('altura dos capítulos', () => {
  it('nenhum capítulo é mais curto que a viewport', () => {
    // `motorRolagem` normaliza o progresso do capítulo por `max(altura,
    // viewport)`. Uma seção menor que a tela nunca chegaria a 1, e o ato
    // seguinte começaria antes da hora — a cena passaria a contar uma coisa
    // enquanto o texto conta outra.
    for (let id = 0; id < TOTAL_ATOS; id++) {
      expect(alturaDoAto(id as IndiceAto)).toBeGreaterThanOrEqual(1)
    }
  })

  it('sobra permanência para o conteúdo grudado ser lido', () => {
    // O conteúdo é `sticky`: ele fica parado durante `altura - 1` viewports.
    // Sem folga aqui, o texto encosta no topo e já começa a subir.
    for (let id = 0; id < TOTAL_ATOS; id++) {
      expect(alturaDoAto(id as IndiceAto) - 1).toBeGreaterThanOrEqual(0.5)
    }
  })
})

describe('formações', () => {
  it('descreve todo fragmento em todo ato com números utilizáveis', () => {
    for (let ato = 0; ato < TOTAL_ATOS; ato++) {
      for (let i = 0; i < CAMPO.n; i++) {
        const f = fragmento(i, ato)
        for (const [nome, v] of Object.entries(f)) {
          expect(Number.isFinite(v), `ato ${ato}, fragmento ${i}, ${nome}`).toBe(true)
        }
        // NaN ou tamanho negativo não quebram o shader: viram fragmento
        // invisível ou virado do avesso, que é bem mais difícil de rastrear
        // depois, olhando a tela.
        expect(f.meiaLargura).toBeGreaterThan(0)
        expect(f.meiaAltura).toBeGreaterThan(0)
        expect(f.opacidade).toBeGreaterThanOrEqual(0)
        expect(f.opacidade).toBeLessThanOrEqual(1)
        expect(f.tinta).toBeGreaterThanOrEqual(0)
        expect(f.tinta).toBeLessThanOrEqual(1)
      }
    }
  })

  it('mantém a cor de marca como acento, e não como cor dominante', () => {
    // design.md §0.7: o acento é sinal, não decoração.
    //
    // A conta é por ÁREA, não por contagem de fragmentos. O que a regra governa
    // é quanto da composição o olho vê colorido, e os fragmentos tingidos são
    // justamente os menores do campo — os nós do ápice são pontos, enquanto os
    // neutros são planos de cartão várias vezes maiores. Contar unidades daria
    // um número inflado e mediria a coisa errada.
    for (let ato = 0; ato < TOTAL_ATOS; ato++) {
      let area = 0
      let areaTingida = 0
      for (let i = 0; i < CAMPO.n; i++) {
        const f = fragmento(i, ato)
        // Área ponderada pela opacidade: o que está apagado no fundo não
        // participa da leitura de cor.
        const a = f.meiaLargura * f.meiaAltura * f.opacidade
        area += a
        if (f.tinta > 0.5) areaTingida += a
      }
      // Dois atos podem passar do teto do corpo da narrativa, e por motivo
      // declarado — não por descuido:
      //
      //   Capacidade, porque ali a cor É o dado. Só quem passou de 100% recebe
      //   acento, e são barras longas: a área acompanha a mensagem.
      //   Final, porque é o quadro em que a marca fecha a composição — o mesmo
      //   caso das "grandes superfícies" que design.md §0.5 libera.
      //
      // Qualquer outro ato que chegue perto disso é regressão: significa que o
      // acento virou cor de cena em algum lugar onde ele deveria ser sinal.
      const excecao = ato === ATO.CAPACIDADE || ato === ATO.FINAL
      expect(areaTingida / area, ATOS[ato].nome).toBeLessThan(excecao ? 0.32 : 0.16)
    }
  })

  it('usa os mesmos fragmentos em todos os atos', () => {
    // A continuidade da narrativa depende disto: se o campo fosse recriado por
    // cena, seriam dez animações independentes em vez de uma transformação.
    expect(CAMPO.papel).toHaveLength(CAMPO.n)
    expect(Object.values(CAMPO.quantidade).reduce((a, b) => a + b, 0)).toBe(CAMPO.n)
    expect(PAPEIS.length).toBe(Object.keys(CAMPO.quantidade).length)
  })
})

describe('isolamento entre organizações (ato 9)', () => {
  // Esta cena afirma uma coisa específica: o dado de uma organização não
  // encosta no de outra. É a mesma promessa que o produto cumpre no banco, e
  // aqui ela precisa ser verdade na geometria — não "quase", não "de longe
  // parece". Um ajuste distraído numa constante de posição quebraria a
  // afirmação sem quebrar nada que compile.
  const MEIA = [2.05, 2.5, 1.5] as const
  const ARESTAS_POR_CELULA = 8

  /** As paredes das células e o conteúdo delas são endereçados de formas
   *  diferentes: a aresta pertence à caixa que ela desenha (`ordem / 8`), o
   *  conteúdo é distribuído em rodízio (`i % 3`). */
  function celulaDe(i: number): number {
    const papel = PAPEIS[CAMPO.papel[i]]
    const k = CAMPO.ordem[i]
    if (papel === 'barra' && k < CELULAS.length * ARESTAS_POR_CELULA) {
      return Math.floor(k / ARESTAS_POR_CELULA)
    }
    return i % CELULAS.length
  }

  it('todo conteúdo fica dentro da própria célula, com folga da parede', () => {
    for (let i = 0; i < CAMPO.n; i++) {
      const papel = PAPEIS[CAMPO.papel[i]]
      const ehParede = papel === 'barra' && CAMPO.ordem[i] < CELULAS.length * ARESTAS_POR_CELULA
      if (ehParede) continue
      const f = fragmento(i, ATO.ISOLAMENTO)
      const [cx, cy, cz] = CELULAS[celulaDe(i)]
      // Estritamente dentro, não encostado: um fragmento tocando a fronteira
      // sugeriria que atravessar é uma possibilidade.
      expect(Math.abs(f.x - cx), `fragmento ${i} em x`).toBeLessThan(MEIA[0])
      expect(Math.abs(f.y - cy), `fragmento ${i} em y`).toBeLessThan(MEIA[1])
      expect(Math.abs(f.z - cz), `fragmento ${i} em z`).toBeLessThan(MEIA[2])
    }
  })

  it('as paredes ficam exatamente na fronteira da célula que delimitam', () => {
    let paredes = 0
    for (let i = 0; i < CAMPO.n; i++) {
      const papel = PAPEIS[CAMPO.papel[i]]
      const k = CAMPO.ordem[i]
      if (papel !== 'barra' || k >= CELULAS.length * ARESTAS_POR_CELULA) continue
      paredes++
      const f = fragmento(i, ATO.ISOLAMENTO)
      const [cx, cy, cz] = CELULAS[Math.floor(k / ARESTAS_POR_CELULA)]
      expect(Math.abs(f.x - cx), `parede ${i} em x`).toBeLessThanOrEqual(MEIA[0] + 1e-6)
      expect(Math.abs(f.y - cy), `parede ${i} em y`).toBeLessThanOrEqual(MEIA[1] + 1e-6)
      // Toda aresta vive num dos dois planos de profundidade da caixa.
      expect(Math.abs(Math.abs(f.z - cz) - MEIA[2]), `parede ${i} em z`).toBeLessThan(1e-6)
    }
    expect(paredes).toBe(CELULAS.length * ARESTAS_POR_CELULA)
  })

  it('nenhuma conexão cruza a fronteira de uma célula', () => {
    const pares = CONEXOES.pares[ATO.ISOLAMENTO]
    expect(pares.length).toBeGreaterThan(0)
    for (let k = 0; k < pares.length; k += 2) {
      const a = pares[k]
      const b = pares[k + 1]
      expect(a % CELULAS.length, `par ${k / 2}`).toBe(b % CELULAS.length)
    }
  })
})

describe('conexões', () => {
  it('só apontam para fragmentos que existem', () => {
    for (let ato = 0; ato < TOTAL_ATOS; ato++) {
      for (const indice of CONEXOES.pares[ato]) {
        expect(indice, `ato ${ato}`).toBeGreaterThanOrEqual(0)
        expect(indice, `ato ${ato}`).toBeLessThan(CAMPO.n)
      }
    }
  })

  it('nunca ligam um fragmento a ele mesmo', () => {
    for (let ato = 0; ato < TOTAL_ATOS; ato++) {
      const pares = CONEXOES.pares[ato]
      for (let k = 0; k < pares.length; k += 2) {
        expect(pares[k], `ato ${ato}`).not.toBe(pares[k + 1])
      }
    }
  })

  it('cabem no buffer que a cena aloca', () => {
    // A malha de linhas é alocada uma vez no tamanho do maior ato e só o
    // `drawRange` muda. Um ato que estourasse esse máximo desenharia lixo.
    for (let ato = 0; ato < TOTAL_ATOS; ato++) {
      expect(CONEXOES.pares[ato].length / 2).toBeLessThanOrEqual(CONEXOES.maximo)
    }
  })

  it('só existem onde a formação já assentou e a linha significa algo', () => {
    // Ato 0 é o caos: nada está conectado ainda, e é justamente essa ausência
    // que faz a primeira aresta do ato seguinte ter efeito.
    expect(CONEXOES.pares[ATO.DISPERSO].length).toBe(0)
    expect(ATOS[ATO.DISPERSO].linhas).toBe(0)
    for (let ato = 1; ato < TOTAL_ATOS; ato++) {
      if (ATOS[ato].linhas > 0) expect(CONEXOES.pares[ato].length, ATOS[ato].nome).toBeGreaterThan(0)
    }
  })
})

describe('níveis de qualidade', () => {
  it('rebaixam até o piso e param lá', () => {
    let atual: Capacidade = { ...CAPACIDADE_INICIAL, nivel: 'alto', fragmentos: 760, dpr: 2, halo: true, linhas: true }
    const visitados = [atual.nivel]
    for (let i = 0; i < 5; i++) {
      const menor = rebaixar(atual)
      if (!menor) break
      // Rebaixar nunca pode pedir mais trabalho da GPU do que o nível anterior.
      expect(menor.fragmentos).toBeLessThanOrEqual(atual.fragmentos)
      expect(menor.dpr).toBeLessThanOrEqual(atual.dpr)
      atual = menor
      visitados.push(atual.nivel)
    }
    expect(visitados).toEqual(['alto', 'medio', 'baixo'])
    expect(rebaixar(atual)).toBeNull()
  })
})

describe('narrativa', () => {
  it('os atos cobrem a timeline em ordem, sem buraco', () => {
    expect(ATOS).toHaveLength(TOTAL_ATOS)
    for (let i = 1; i < ATOS.length; i++) {
      expect(ATOS[i].inicio, ATOS[i].nome).toBeGreaterThan(ATOS[i - 1].inicio)
    }
    expect(ATOS[0].inicio).toBe(0)
    expect(ATOS[ATOS.length - 1].inicio).toBeLessThan(1)
  })

  it('tem respiro: nem todo ato pode estar em movimento máximo', () => {
    // Sem contraste de intensidade, movimento constante deixa de ser ritmo e
    // vira ruído de fundo. Os capítulos do vértice e do fechamento são os
    // quietos de propósito.
    expect(ATOS[ATO.VERTICE].deriva).toBeLessThan(0.25)
    expect(ATOS[ATO.FINAL].deriva).toBeLessThan(0.25)
    const agitados = ATOS.filter((a) => a.deriva > 0.6).length
    expect(agitados).toBeLessThan(ATOS.length / 2)
  })

  it('o pulso só percorre conexões onde há evento acontecendo', () => {
    // Pulso é "o sistema está executando algo agora". Espalhá-lo por toda a
    // narrativa esvaziaria o significado.
    const comPulso = ATOS.filter((a) => a.pulso).map((a) => a.nome)
    expect(comPulso).toEqual(['Operação', 'Fluxo'])
  })
})
