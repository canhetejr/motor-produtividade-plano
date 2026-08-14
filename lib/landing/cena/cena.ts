import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DataTexture,
  FloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

import { ATOS, TOTAL_ATOS } from '../atos'
import { AMORTECIMENTO, CORES_CENA, DISPERSAO_ATO, PONTEIRO } from '../movimento'
import { rebaixar, type Capacidade } from '../dispositivo'
import { criarCampo, type Campo } from './formacoes'
import { montarConexoes, type Conexoes } from './conexoes'
import { FRAGMENT_FRAGMENTOS, FRAGMENT_LINHAS, VERTEX_FRAGMENTOS, VERTEX_LINHAS } from './shaders'

/**
 * A cena persistente.
 *
 * Uma classe imperativa, e não um componente: a cena precisa de números novos
 * sessenta vezes por segundo, e passar isso por estado do React seria um
 * re-render por quadro. O React monta, entrega o canvas e sai do caminho —
 * `definirAto` e `definirPonteiro` são as duas únicas portas de entrada.
 *
 * Dois draw calls no total (um campo instanciado, uma malha de linhas), porque
 * o filme inteiro é função de um float: `uAto`. Trocar de cena não troca de
 * geometria, não troca de material e não aloca nada.
 */

export type Instrumentacao = {
  fps: number
  dpr: number
  nivel: string
  ato: string
  progresso: number
  fragmentos: number
}

type Opcoes = {
  canvas: HTMLCanvasElement
  capacidade: Capacidade
  /** Pulso de convergência (0–1) para o DOM reagir junto ao fundo. */
  aoPulsar?: (valor: number) => void
}

const EIXO_Z = new Vector3(0, 0, 1)

export class CenaConvergencia {
  private renderer: WebGLRenderer
  private cena = new Scene()
  private camera: PerspectiveCamera
  private campo: Campo
  private conexoes: Conexoes
  private malha: Mesh
  private linhas: LineSegments
  private matFragmentos: ShaderMaterial
  private matLinhas: ShaderMaterial
  private texPosicao: DataTexture
  private texForma: DataTexture

  private capacidade: Capacidade
  private opcoes: Opcoes

  private quadro = 0
  private relogio = 0
  private ultimoT = 0
  private rodando = false
  private perdido = false

  /** Posição na narrativa vinda da rolagem, e o valor amortecido que a cena
   *  realmente usa. Amortecer aqui, e não no motor de rolagem, é o que deixa a
   *  cena com inércia de câmera enquanto o texto do DOM acompanha o dedo. */
  private atoAlvo = 0
  private atoSuave = 0
  private ponteiroAlvo = new Vector2()
  private ponteiroSuave = new Vector2()

  private camPos = new Vector3()
  private camAlvo = new Vector3()
  private camFov = 44
  private atoLinhasAtual = -1

  private amostras: number[] = []
  private rebaixamentos = 0

  private largura = 0
  private altura = 0

  constructor(opcoes: Opcoes) {
    this.opcoes = opcoes
    this.capacidade = opcoes.capacidade

    this.renderer = new WebGLRenderer({
      canvas: opcoes.canvas,
      // Sem MSAA. O shader já resolve a borda de cada fragmento
      // analiticamente (`fwidth` no SDF do retângulo), então o multisample não
      // melhora nada visível aqui — e num canvas de tela cheia com tudo
      // alpha-blended ele custa banda de memória a cada quadro.
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      // A cena nunca é lida de volta e nunca compõe com screenshot: preservar
      // o buffer só custaria memória.
      preserveDrawingBuffer: false,
    })
    this.renderer.setClearAlpha(0)

    this.camera = new PerspectiveCamera(44, 1, 0.1, 120)
    this.camPos.set(...ATOS[0].camera.pos)
    this.camAlvo.set(...ATOS[0].camera.alvo)

    this.campo = criarCampo(this.capacidade.fragmentos)
    this.conexoes = montarConexoes(this.campo)

    this.texPosicao = this.criarTextura(this.campo.posicao)
    this.texForma = this.criarTextura(this.campo.forma)

    this.matFragmentos = new ShaderMaterial({
      vertexShader: VERTEX_FRAGMENTOS,
      fragmentShader: FRAGMENT_FRAGMENTOS,
      transparent: true,
      // Aditivo é comutativo, então o resultado não depende da ordem de
      // desenho — some o problema de ordenar centenas de quads transparentes
      // por profundidade a cada quadro. Por isso também `depthWrite: false`.
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      uniforms: this.uniformesComuns({
        uEntrada: { value: 0 },
        uHalo: { value: this.capacidade.halo ? 1 : 0 },
        uCorAcento: { value: new Color(...CORES_CENA.acento) },
        uCorNeutro: { value: new Color(...CORES_CENA.neutro) },
        uConvergencia: { value: 0 },
      }),
    })

    this.matLinhas = new ShaderMaterial({
      vertexShader: VERTEX_LINHAS,
      fragmentShader: FRAGMENT_LINHAS,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      uniforms: this.uniformesComuns({
        uEntrada: { value: 0 },
        uOpacidade: { value: 0 },
        uPulso: { value: 0 },
        uCorAcento: { value: new Color(...CORES_CENA.acento) },
        uCorNeutro: { value: new Color(...CORES_CENA.neutro) },
      }),
    })

    this.malha = new Mesh(this.geometriaFragmentos(), this.matFragmentos)
    // A geometria é um quad unitário deslocado no shader; a bounding box que o
    // three calcularia não descreve onde os fragmentos realmente estão, e o
    // culling sumiria com a cena inteira em certos ângulos.
    this.malha.frustumCulled = false
    this.cena.add(this.malha)

    this.linhas = new LineSegments(this.geometriaLinhas(), this.matLinhas)
    this.linhas.frustumCulled = false
    this.linhas.visible = this.capacidade.linhas
    this.cena.add(this.linhas)

    opcoes.canvas.addEventListener('webglcontextlost', this.aoPerderContexto)
    opcoes.canvas.addEventListener('webglcontextrestored', this.aoRestaurarContexto)
  }

  private uniformesComuns(extra: Record<string, { value: unknown }>) {
    return {
      tPosicao: { value: this.texPosicao },
      tForma: { value: this.texForma },
      uDim: { value: new Vector2(this.campo.n, TOTAL_ATOS) },
      uAto: { value: 0 },
      uTempo: { value: 0 },
      uPonteiro: { value: new Vector2() },
      uForcaPonteiro: { value: this.capacidade.ponteiro ? PONTEIRO.campo : 0 },
      uDeriva: { value: 1 },
      uDispersao: { value: DISPERSAO_ATO },
      ...extra,
    }
  }

  /** Textura de dados: `n` colunas × 11 atos. NEAREST porque a interpolação
   *  entre atos é feita à mão no shader — filtragem linear misturaria atos
   *  vizinhos de forma incontrolável, e float linear nem é garantido. */
  private criarTextura(dados: Float32Array) {
    const tex = new DataTexture(dados, this.campo.n, TOTAL_ATOS, RGBAFormat, FloatType)
    tex.minFilter = NearestFilter
    tex.magFilter = NearestFilter
    tex.generateMipmaps = false
    tex.needsUpdate = true
    return tex
  }

  private geometriaFragmentos() {
    const base = new PlaneGeometry(1, 1)
    const geo = new InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.uv = base.attributes.uv
    base.dispose()

    const indices = new Float32Array(this.campo.n)
    for (let i = 0; i < this.campo.n; i++) indices[i] = i
    geo.setAttribute('aIndice', new InstancedBufferAttribute(indices, 1))
    geo.setAttribute('aSemente', new InstancedBufferAttribute(this.campo.semente, 1))
    geo.instanceCount = this.campo.n
    return geo
  }

  /** As linhas não têm posição própria: cada vértice guarda o índice do
   *  fragmento que ele acompanha, e o shader busca a posição na mesma textura.
   *  O buffer é alocado no tamanho do maior ato e só o `drawRange` muda. */
  private geometriaLinhas() {
    const max = Math.max(this.conexoes.maximo, 1)
    const geo = new InstancedBufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(max * 2 * 3), 3))
    geo.setAttribute('aIndice', new BufferAttribute(new Float32Array(max * 2), 1))
    geo.setAttribute('aSemente', new BufferAttribute(new Float32Array(max * 2), 1))
    geo.setAttribute('aPonta', new BufferAttribute(new Float32Array(max * 2), 1))
    geo.setAttribute('aPar', new BufferAttribute(new Float32Array(max * 2), 1))
    geo.instanceCount = 1
    geo.setDrawRange(0, 0)
    return geo
  }

  private aplicarLinhasDoAto(ato: number) {
    if (this.atoLinhasAtual === ato || !this.capacidade.linhas) return
    this.atoLinhasAtual = ato
    const pares = this.conexoes.pares[ato]
    const geo = this.linhas.geometry
    const indice = geo.getAttribute('aIndice') as BufferAttribute
    const semente = geo.getAttribute('aSemente') as BufferAttribute
    const ponta = geo.getAttribute('aPonta') as BufferAttribute
    const par = geo.getAttribute('aPar') as BufferAttribute

    const total = pares.length / 2
    for (let k = 0; k < total; k++) {
      for (let e = 0; e < 2; e++) {
        const v = k * 2 + e
        const frag = pares[k * 2 + e]
        indice.setX(v, frag)
        semente.setX(v, this.campo.semente[frag])
        ponta.setX(v, e)
        par.setX(v, total > 1 ? k / total : 0)
      }
    }
    indice.needsUpdate = true
    semente.needsUpdate = true
    ponta.needsUpdate = true
    par.needsUpdate = true
    geo.setDrawRange(0, total * 2)
  }

  /* ── Entradas ──────────────────────────────────────────────────────────── */

  /** Posição contínua na narrativa (0 → 10). Única porta de entrada da
   *  rolagem: quem manda é `motorRolagem`, que mede as seções de verdade. */
  definirAto(ato: number) {
    this.atoAlvo = Math.min(Math.max(ato, 0), TOTAL_ATOS - 1)
  }

  /** Ponteiro normalizado (-1 → 1 nos dois eixos). */
  definirPonteiro(x: number, y: number) {
    if (!this.capacidade.ponteiro) return
    this.ponteiroAlvo.set(x, y)
  }

  redimensionar(largura: number, altura: number) {
    if (largura === this.largura && altura === this.altura) return
    this.largura = largura
    this.altura = altura
    this.renderer.setPixelRatio(this.capacidade.dpr)
    this.renderer.setSize(largura, altura, false)
    this.camera.aspect = largura / Math.max(altura, 1)
    this.camera.updateProjectionMatrix()
    if (!this.rodando) this.desenhar(0)
  }

  iniciar() {
    if (this.rodando || this.perdido) return
    this.rodando = true
    this.ultimoT = performance.now()
    this.quadro = requestAnimationFrame(this.laco)
  }

  parar() {
    this.rodando = false
    if (this.quadro) cancelAnimationFrame(this.quadro)
    this.quadro = 0
  }

  /* ── Laço ──────────────────────────────────────────────────────────────── */

  private laco = (agora: number) => {
    if (!this.rodando) return
    // Teto no delta: uma aba que volta do segundo plano entregaria um salto de
    // vários segundos e teleportaria a cena inteira.
    //
    // E piso em zero, que não é paranoia: o timestamp que o rAF entrega é o do
    // INÍCIO do quadro, e esse instante pode ser anterior ao `performance.now()`
    // lido em `iniciar()` logo antes de pedir o quadro. O delta negativo
    // resultante inverte o sinal do coeficiente de amortecimento, e aí a
    // suavização passa a afastar o valor do alvo em vez de aproximá-lo — o ato
    // contínuo ficava negativo e a câmera indexava `ATOS[-1]`. Só aparecia num
    // refresh no meio da página, onde o alvo inicial é distante o bastante para
    // o desvio sair da faixa válida.
    const dt = Math.min(Math.max((agora - this.ultimoT) / 1000, 0), 0.05)
    this.ultimoT = agora
    this.medir(dt)
    this.desenhar(dt)
    this.quadro = requestAnimationFrame(this.laco)
  }

  private medir(dt: number) {
    if (dt <= 0) return
    this.amostras.push(dt)
    if (this.amostras.length < 100) return
    const media = this.amostras.reduce((a, b) => a + b, 0) / this.amostras.length
    this.amostras.length = 0
    this.ultimoFps = 1 / media
    // ~45 fps sustentados é o limite: abaixo disso o movimento deixa de ler
    // como câmera e passa a ler como travamento. Densidade é o que se perde
    // primeiro, porque fluidez é parte do design.
    if (media > 0.022 && this.rebaixamentos < 2) {
      const menor = rebaixar(this.capacidade)
      if (menor) {
        this.rebaixamentos++
        this.aplicarCapacidade(menor)
      }
    }
  }

  private ultimoFps = 60

  /** Rebaixa sem reconstruir o campo: mexer em DPR, halo e linhas devolve a
   *  maior parte do quadro sem recriar geometria nem texturas no meio da
   *  narrativa (o que apareceria como um salto). */
  private aplicarCapacidade(c: Capacidade) {
    this.capacidade = { ...c, fragmentos: this.campo.n }
    this.renderer.setPixelRatio(c.dpr)
    this.renderer.setSize(this.largura, this.altura, false)
    this.matFragmentos.uniforms.uHalo.value = c.halo ? 1 : 0
    this.matFragmentos.uniforms.uForcaPonteiro.value = c.ponteiro ? PONTEIRO.campo : 0
    this.matLinhas.uniforms.uForcaPonteiro.value = c.ponteiro ? PONTEIRO.campo : 0
    this.linhas.visible = c.linhas
  }

  private desenhar(dt: number) {
    const reduzido = this.capacidade.reduzido

    if (reduzido) {
      // Movimento reduzido: sem scrub, sem deriva, sem parallax. A cena vai
      // direto para a formação mais próxima e fica parada — o mesmo conteúdo,
      // sem deslocamento. Continua sendo uma composição, não uma tela vazia.
      this.atoSuave = Math.round(this.atoAlvo)
      this.relogio = 0
    } else {
      // Suavização independente de taxa de quadros: com um fator fixo por
      // quadro, a cena andaria mais rápido num monitor de 120 Hz.
      const k = 1 - Math.exp(-AMORTECIMENTO.progresso * dt)
      this.atoSuave += (this.atoAlvo - this.atoSuave) * k
      const kp = 1 - Math.exp(-AMORTECIMENTO.ponteiro * dt)
      this.ponteiroSuave.x += (this.ponteiroAlvo.x - this.ponteiroSuave.x) * kp
      this.ponteiroSuave.y += (this.ponteiroAlvo.y - this.ponteiroSuave.y) * kp
      this.relogio += dt
    }

    const atoContinuo = this.atoSuave
    const dominante = Math.min(Math.max(Math.round(atoContinuo), 0), TOTAL_ATOS - 1)
    const def = ATOS[dominante]

    this.aplicarLinhasDoAto(dominante)

    // Pulso de convergência: um instante de luz quando a estrutura fecha, nos
    // dois momentos em que ela fecha. Elegância, não explosão.
    const pulsoEm = (alvo: number) => {
      const d = Math.abs(atoContinuo - alvo)
      return d > 0.22 ? 0 : Math.pow(1 - d / 0.22, 2)
    }
    const convergencia = reduzido ? 0 : Math.max(pulsoEm(3) * 0.9, pulsoEm(10) * 0.75)
    this.opcoes.aoPulsar?.(convergencia)

    const uf = this.matFragmentos.uniforms
    const ul = this.matLinhas.uniforms
    uf.uAto.value = atoContinuo
    ul.uAto.value = atoContinuo
    uf.uTempo.value = this.relogio
    ul.uTempo.value = this.relogio
    uf.uDeriva.value = reduzido ? 0 : def.deriva
    ul.uDeriva.value = reduzido ? 0 : def.deriva
    uf.uConvergencia.value = convergencia
    ;(uf.uPonteiro.value as Vector2).copy(this.ponteiroSuave)
    ;(ul.uPonteiro.value as Vector2).copy(this.ponteiroSuave)

    // As linhas somem no meio de cada transição e voltam quando a formação
    // assenta: é o que faz elas parecerem "descobertas" da estrutura em vez de
    // um grafo permanente arrastado pela cena.
    const assentamento = 1 - Math.min(Math.abs(atoContinuo - dominante) / 0.42, 1)
    ul.uOpacidade.value = def.linhas * assentamento * (uf.uEntrada.value as number)
    ul.uPulso.value = def.pulso && !reduzido ? assentamento : 0

    // Entrada da cena: sobe de 0 a 1 depois do primeiro quadro, para o canvas
    // aparecer sem salto sobre o conteúdo que já estava na tela.
    const entrada = Math.min((uf.uEntrada.value as number) + dt * 0.9, 1)
    uf.uEntrada.value = reduzido ? 1 : entrada
    ul.uEntrada.value = uf.uEntrada.value

    this.atualizarCamera(dt, atoContinuo, reduzido)
    this.renderer.render(this.cena, this.camera)
  }

  private alvoPos = new Vector3()
  private alvoOlhar = new Vector3()

  private atualizarCamera(dt: number, atoContinuo: number, reduzido: boolean) {
    // Índice preso à faixa válida nos dois extremos. Um laço de render não pode
    // depender de todos os produtores upstream serem bem-comportados: aqui um
    // único quadro fora da faixa derruba a página inteira com uma exceção.
    const a = Math.min(Math.max(Math.floor(atoContinuo), 0), TOTAL_ATOS - 1)
    const b = Math.min(a + 1, TOTAL_ATOS - 1)
    const f = Math.min(Math.max(atoContinuo - a, 0), 1)
    // A câmera usa uma curva mais suave que os fragmentos: eles podem chegar
    // com aceleração, ela não pode — é o ponto de vista de quem assiste.
    const s = f * f * (3 - 2 * f)

    const ca = ATOS[a].camera
    const cb = ATOS[b].camera
    this.alvoPos.set(
      ca.pos[0] + (cb.pos[0] - ca.pos[0]) * s,
      ca.pos[1] + (cb.pos[1] - ca.pos[1]) * s,
      ca.pos[2] + (cb.pos[2] - ca.pos[2]) * s
    )
    this.alvoOlhar.set(
      ca.alvo[0] + (cb.alvo[0] - ca.alvo[0]) * s,
      ca.alvo[1] + (cb.alvo[1] - ca.alvo[1]) * s,
      ca.alvo[2] + (cb.alvo[2] - ca.alvo[2]) * s
    )
    const fov = ca.fov + (cb.fov - ca.fov) * s

    if (!reduzido) {
      // A câmera sugere o ponteiro; nunca o persegue. Amplitude pequena e
      // invertida — o mundo se inclina em direção ao cursor.
      this.alvoPos.x += this.ponteiroSuave.x * PONTEIRO.camera
      this.alvoPos.y += this.ponteiroSuave.y * PONTEIRO.camera * 0.6
    }

    const k = reduzido ? 1 : 1 - Math.exp(-AMORTECIMENTO.camera * dt)
    this.camPos.lerp(this.alvoPos, k)
    this.camAlvo.lerp(this.alvoOlhar, k)
    this.camFov += (fov - this.camFov) * k

    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camAlvo)
    // Rotação mínima no eixo de visão: tira a simetria perfeita sem que o
    // movimento chegue a ser percebido como rotação (e sem embrulhar ninguém).
    if (!reduzido) this.camera.rotateOnAxis(EIXO_Z, this.ponteiroSuave.x * PONTEIRO.rotacao)
    if (Math.abs(this.camera.fov - this.camFov) > 0.01) {
      this.camera.fov = this.camFov
      this.camera.updateProjectionMatrix()
    }
  }

  /* ── Contexto e limpeza ────────────────────────────────────────────────── */

  private aoPerderContexto = (e: Event) => {
    // Sem preventDefault o navegador nunca dispara `restored`, e a landing
    // fica com um canvas preto até um reload manual.
    e.preventDefault()
    this.perdido = true
    this.parar()
  }

  private aoRestaurarContexto = () => {
    this.perdido = false
    this.texPosicao.needsUpdate = true
    this.texForma.needsUpdate = true
    this.atoLinhasAtual = -1
    this.matFragmentos.uniforms.uEntrada.value = 0
    this.matLinhas.uniforms.uEntrada.value = 0
    this.renderer.setPixelRatio(this.capacidade.dpr)
    this.renderer.setSize(this.largura, this.altura, false)
    this.iniciar()
  }

  instrumentacao(): Instrumentacao {
    const ato = Math.min(Math.max(Math.round(this.atoSuave), 0), TOTAL_ATOS - 1)
    return {
      fps: Math.round(this.ultimoFps),
      dpr: this.capacidade.dpr,
      nivel: this.capacidade.nivel,
      ato: ATOS[ato].nome,
      progresso: this.atoSuave / (TOTAL_ATOS - 1),
      fragmentos: this.campo.n,
    }
  }

  destruir() {
    this.parar()
    this.opcoes.canvas.removeEventListener('webglcontextlost', this.aoPerderContexto)
    this.opcoes.canvas.removeEventListener('webglcontextrestored', this.aoRestaurarContexto)
    this.malha.geometry.dispose()
    this.linhas.geometry.dispose()
    this.matFragmentos.dispose()
    this.matLinhas.dispose()
    this.texPosicao.dispose()
    this.texForma.dispose()
    this.renderer.dispose()
    // Sem isto o contexto WebGL fica vivo até o GC do navegador decidir
    // recolher — e o limite de contextos por aba é baixo o bastante para que
    // navegar entre rotas algumas vezes derrube a cena.
    this.renderer.forceContextLoss()
  }
}
