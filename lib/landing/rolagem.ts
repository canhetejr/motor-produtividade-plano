/**
 * Motor de rolagem da narrativa.
 *
 * Uma decisão estrutural: a posição no filme NÃO vem de uma fração da altura
 * total da página, vem das próprias seções. Cada capítulo do DOM se registra, e
 * o ato contínuo é `índice da seção + progresso dentro dela`.
 *
 * O caminho óbvio — normalizar `scrollY` sobre a altura do documento e fatiar
 * essa faixa em atos — parece equivalente e não é: a faixa rolável é a altura
 * do documento *menos uma viewport*, então as fronteiras calculadas escorregam
 * quase uma tela em relação às seções que deveriam marcá-las. O texto passa a
 * falar de dados enquanto a cena ainda mostra o quadro, e o erro muda de
 * tamanho conforme a altura da janela. Medindo a seção, isso não tem como
 * acontecer: a fronteira do ato *é* a fronteira do capítulo.
 *
 * ── Dois relógios, e o motivo de serem dois ──────────────────────────────────
 *
 * `local` mede o capítulo a partir do momento em que o topo dele passa do topo
 * da tela. É o relógio da CENA: ele começa exatamente onde o anterior termina,
 * o que faz as formações 3D se emendarem sem sobra nem buraco.
 *
 * `visivel` mede o capítulo desde que ele entra pela base da tela até sair pelo
 * topo. É o relógio do DOM.
 *
 * A separação não é preciosismo. O conteúdo é `sticky`, então ele aparece e já
 * está legível uma tela inteira ANTES de `local` sair de zero. Um contador
 * ligado a `local` mostra "0%" durante toda essa tela, e o painel de capacidade
 * chega a ficar completamente vazio enquanto o texto ao lado já foi lido — foi
 * exatamente o que aconteceu antes desta separação existir. `visivel` sobe
 * junto com a entrada do bloco, que é quando a revelação precisa acontecer.
 *
 * Um só listener de rolagem e um só de resize para a página inteira, e todas as
 * leituras de layout num único ponto por quadro, para nunca intercalar leitura
 * e escrita de estilo (que é o que provoca layout thrashing).
 */

type EstadoRolagem = {
  /** Posição contínua na narrativa: 3.4 = 40% do caminho do ato 3 para o 4. */
  ato: number
  /** Progresso bruto dentro do capítulo atual (0–1), sem moldagem. */
  local: number
  /** Índice do capítulo atual. */
  indice: number
  /** Progresso global aproximado (0–1), para barra de progresso e depuração. */
  global: number
}

/** O que cada capítulo recebe sobre si mesmo, uma vez por quadro. */
type EstadoCapitulo = {
  local: number
  visivel: number
}

type Assinante = (estado: EstadoRolagem) => void
type AssinanteCapitulo = (estado: EstadoCapitulo) => void

/**
 * Curva de permanência da cena. Sem ela, a formação começa a se desfazer no
 * primeiro pixel de rolagem e nunca fica parada tempo suficiente para ser lida
 * — veem-se dez transições e nenhuma cena.
 *
 * Os primeiros 14% do capítulo seguram a formação montada, a transformação
 * acontece até 72%, e o resto já mostra a formação seguinte enquanto o texto
 * deste capítulo sai. É essa pausa que cria o ritmo de calma → movimento →
 * calma.
 */
export function moldar(local: number): number {
  const ESPERA = 0.14
  const FIM = 0.72
  if (local <= ESPERA) return 0
  if (local >= FIM) return 1
  const p = (local - ESPERA) / (FIM - ESPERA)
  return p * p * (3 - 2 * p)
}

type Registro = { el: HTMLElement; abrange: number; ouvinte?: AssinanteCapitulo }

class Motor {
  private secoes: (Registro | null)[] = []
  private assinantes = new Set<Assinante>()
  private estado: EstadoRolagem = { ato: 0, local: 0, indice: 0, global: 0 }
  private agendado = false
  private ligado = false

  /** `abrange` é quantos atos a seção cobre. O quadro Kanban se monta e depois
   *  opera: são dois atos numa seção só, para o painel do produto ficar grudado
   *  durante a cena inteira em vez de sair e voltar na fronteira entre eles. */
  registrar(indice: number, el: HTMLElement, abrange = 1, ouvinte?: AssinanteCapitulo) {
    this.secoes[indice] = { el, abrange, ouvinte }
    this.ligar()
    this.agendar()
    return () => {
      if (this.secoes[indice]?.el === el) this.secoes[indice] = null
    }
  }

  assinar(fn: Assinante) {
    this.assinantes.add(fn)
    this.ligar()
    fn(this.estado)
    return () => {
      this.assinantes.delete(fn)
    }
  }

  private ligar() {
    if (this.ligado || typeof window === 'undefined') return
    this.ligado = true
    window.addEventListener('scroll', this.agendar, { passive: true })
    window.addEventListener('resize', this.agendar)
    // Um refresh no meio da página restaura a rolagem *depois* do primeiro
    // quadro; sem esta medida a cena abriria no ato 0 e daria um salto.
    this.agendar()
  }

  private agendar = () => {
    if (this.agendado) return
    this.agendado = true
    requestAnimationFrame(this.medir)
  }

  private medir = () => {
    this.agendado = false
    const vh = window.innerHeight
    let indice = 0
    let local = 0
    let base = 0
    let acumulado = 0

    // Uma passada só por todas as seções: todas as leituras de layout juntas,
    // nenhuma escrita no meio.
    for (let i = 0; i < this.secoes.length; i++) {
      const sec = this.secoes[i]
      if (!sec) continue
      const r = sec.el.getBoundingClientRect()
      const altura = Math.max(r.height, 1)

      if (sec.ouvinte) {
        sec.ouvinte({
          // Relógio da cena: só anda depois que o topo cruza o topo da tela.
          local: Math.min(Math.max(-r.top / Math.max(altura, vh), 0), 1),
          // Relógio do DOM: anda desde a entrada pela base até a saída pelo topo.
          visivel: Math.min(Math.max((vh - r.top) / (altura + vh), 0), 1),
        })
      }

      // O capítulo "atual" é o último cujo topo já passou do topo da tela.
      if (r.top <= 1 || i === 0) {
        indice = i
        base = acumulado
        local = Math.min(Math.max(-r.top / Math.max(altura, vh), 0), 1)
      }
      acumulado += sec.abrange
    }

    const abrange = this.secoes[indice]?.abrange ?? 1
    this.estado = {
      indice,
      local,
      ato: base + abrange * moldar(local),
      global: acumulado > 0 ? Math.min((base + abrange * local) / acumulado, 1) : 0,
    }
    for (const fn of this.assinantes) fn(this.estado)
  }
}

export const motorRolagem = new Motor()
