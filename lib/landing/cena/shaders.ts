/**
 * Shaders da cena.
 *
 * Escritos em sintaxe GLSL 1 de propósito: `ShaderMaterial` (não Raw) desta
 * versão do three compila tudo como `#version 300 es` e injeta os defines de
 * compatibilidade (`attribute`→`in`, `varying`→`in`/`out`, `texture2D`→
 * `texture`, `gl_FragColor`→`pc_fragColor`). O código fica na forma legível e
 * mesmo assim roda em ES 3.00, onde `fwidth` é núcleo da linguagem e não
 * depende de extensão. Definir `glslVersion: GLSL3` aqui seria pior: os
 * defines de `gl_FragColor` deixam de ser emitidos e não se ganha nada.
 */

/** Amostragem das texturas de dados + interpolação entre atos. Compartilhado
 *  entre fragmentos e linhas para que os dois leiam exatamente a mesma
 *  posição — não existe segunda fonte de verdade que possa dessincronizar. */
const COMUM = /* glsl */ `
  uniform sampler2D tPosicao;
  uniform sampler2D tForma;
  uniform vec2 uDim;          // (n fragmentos, n atos)
  uniform float uAto;         // posição contínua na narrativa: 0 → 10
  uniform float uTempo;
  uniform vec2 uPonteiro;
  uniform float uForcaPonteiro;
  uniform float uDeriva;
  uniform float uDispersao;

  vec4 amostrar(sampler2D tex, float indice, float ato) {
    return texture2D(tex, vec2((indice + 0.5) / uDim.x, (ato + 0.5) / uDim.y));
  }

  /**
   * Progresso individual do fragmento dentro da transição.
   *
   * Dois desvios deliberados da interpolação linear, que é o que separa "um
   * enxame sendo atraído" de "uma matriz sendo interpolada":
   *
   *  - atraso proporcional à semente, então nem todo mundo parte junto;
   *  - curva que acelera na aproximação e assenta no fim, em vez de velocidade
   *    constante.
   */
  float progresso(float f, float semente) {
    float atraso = semente * uDispersao;
    float local = clamp((f - atraso) / max(1.0 - uDispersao, 0.001), 0.0, 1.0);
    float e = pow(local, 2.3);
    return mix(e, smoothstep(0.0, 1.0, local), smoothstep(0.78, 1.0, local));
  }

  /** Posição do fragmento agora: mistura dos dois atos + deriva + ponteiro. */
  vec3 posicaoDe(float indice, float semente, out float meiaL, out vec4 forma) {
    float atoA = floor(uAto);
    float atoB = min(atoA + 1.0, uDim.y - 1.0);
    float e = progresso(uAto - atoA, semente);

    vec4 pa = amostrar(tPosicao, indice, atoA);
    vec4 pb = amostrar(tPosicao, indice, atoB);
    vec4 fa = amostrar(tForma, indice, atoA);
    vec4 fb = amostrar(tForma, indice, atoB);

    vec3 p = mix(pa.xyz, pb.xyz, e);
    meiaL = mix(pa.w, pb.w, e);
    forma = mix(fa, fb, e);

    // Desvio lateral no meio do caminho: a trajetória curva em vez de cortar
    // reto entre duas formações. Reta lê como interpolação; curva lê como
    // objeto atravessando o espaço.
    vec3 d = pb.xyz - pa.xyz;
    float comp = length(d);
    if (comp > 0.001) {
      vec3 lateral = normalize(cross(d / comp, vec3(0.0, 0.0, 1.0)) + vec3(0.0, 0.001, 0.0));
      p += lateral * sin(e * 3.14159265) * min(comp * 0.13, 0.62) * (semente - 0.5) * 2.0;
    }

    // Deriva: a cena nunca fica completamente morta, mas a amplitude é
    // controlada por ato — cenas de respiração quase param.
    float fase = semente * 6.2831853;
    p.x += sin(uTempo * 0.31 + fase) * 0.085 * uDeriva;
    p.y += cos(uTempo * 0.27 + fase * 1.7) * 0.07 * uDeriva;
    p.z += sin(uTempo * 0.19 + fase * 2.3) * 0.11 * uDeriva;

    // Parallax do ponteiro pesado pela profundidade: o que está perto responde
    // muito mais que o que está longe. É a desigualdade que vende o volume —
    // deslocamento uniforme só faria a cena inteira escorregar.
    float prof = clamp((p.z + 12.0) / 18.0, 0.0, 1.0);
    p.xy += uPonteiro * uForcaPonteiro * (0.15 + prof * 1.05);

    return p;
  }
`

export const VERTEX_FRAGMENTOS = /* glsl */ `
  ${COMUM}

  attribute float aIndice;
  attribute float aSemente;

  uniform float uEntrada;     // 0 → 1: chegada da cena depois do load
  uniform float uHalo;        // 0 em nível baixo — halo custa fill rate
  uniform vec3 uCorAcento;
  uniform vec3 uCorNeutro;
  uniform float uConvergencia; // pulso no instante exato do vértice

  varying vec2 vQuad;      // -1 → 1 dentro do quad já expandido
  varying vec2 vMeia;      // retângulo real, como fração do quad
  varying float vSolidez;
  varying float vOpacidade;
  varying vec3 vCor;
  varying float vHalo;

  void main() {
    float meiaL;
    vec4 forma;
    vec3 p = posicaoDe(aIndice, aSemente, meiaL, forma);

    float meiaA = forma.x;
    float tinta = forma.y;
    vOpacidade = forma.z * uEntrada;
    vSolidez = forma.w;

    // Margem aditiva (não multiplicativa) para o halo caber: uma barra de
    // 0.01 de meia-altura não ganharia folga nenhuma com margem proporcional.
    float margem = uHalo * 0.075;
    vec2 quad = vec2(meiaL, meiaA) + margem;
    vMeia = vec2(meiaL, meiaA) / quad;
    vQuad = position.xy * 2.0;
    vHalo = uHalo;

    vCor = mix(uCorNeutro, uCorAcento, tinta);
    // O pulso do momento de convergência entra como luz, não como explosão:
    // sobe o brilho e a opacidade por um instante e volta.
    vCor += uCorAcento * uConvergencia * 0.5;
    vOpacidade = min(vOpacidade * (1.0 + uConvergencia * 0.7), 1.0);

    // Billboard em espaço de visão: cada fragmento é uma superfície de UI
    // sempre voltada para quem olha. A estrutura 3D vive nas posições, não na
    // orientação de cada peça — girar as peças só custaria legibilidade.
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += position.xy * 2.0 * quad;
    gl_Position = projectionMatrix * mv;
  }
`

export const FRAGMENT_FRAGMENTOS = /* glsl */ `
  precision highp float;

  varying vec2 vQuad;
  varying vec2 vMeia;
  varying float vSolidez;
  varying float vOpacidade;
  varying vec3 vCor;
  varying float vHalo;

  /** Retângulo arredondado com sinal. O raio sai proporcional ao lado menor,
   *  o que reproduz a linguagem de canto do produto em qualquer tamanho. */
  float retangulo(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    float raio = min(vMeia.x, vMeia.y) * 0.45;
    float d = retangulo(vQuad, vMeia, raio);

    // Antialiasing pela derivada: a aresta fica com a mesma espessura ótica
    // perto ou longe da câmera, que é o que impede o campo de "ferver" quando
    // a câmera se move.
    float aa = max(fwidth(d), 0.0008);

    // Aresta viva + preenchimento fraco: vidro, não bloco opaco.
    float espessura = aa * 1.1;
    float borda = 1.0 - smoothstep(espessura, espessura + aa * 1.6, abs(d));
    float dentro = 1.0 - smoothstep(-aa, aa, d);
    // Halo em vez de bloom: o brilho nasce dentro do próprio fragmento, sem
    // passe de tela cheia. Contido por construção — não tem como vazar para a
    // página inteira como um bloom mal calibrado.
    float halo = exp(-max(d, 0.0) * 15.0) * vHalo;

    float alfa = (borda * 0.92 + dentro * vSolidez * 0.6 + halo * 0.3) * vOpacidade;
    if (alfa < 0.004) discard;

    gl_FragColor = vec4(vCor, alfa);
  }
`

export const VERTEX_LINHAS = /* glsl */ `
  ${COMUM}

  attribute float aIndice;
  attribute float aSemente;
  attribute float aPonta;     // 0 na origem, 1 no destino
  attribute float aPar;       // id normalizado do par, para defasar o pulso

  uniform float uEntrada;

  varying float vAo;
  varying float vPar;

  void main() {
    float meiaL;
    vec4 forma;
    vec3 p = posicaoDe(aIndice, aSemente, meiaL, forma);
    vAo = aPonta;
    vPar = aPar;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

export const FRAGMENT_LINHAS = /* glsl */ `
  precision highp float;

  uniform float uOpacidade;
  uniform float uTempo;
  uniform float uPulso;       // 0 = linha estática, 1 = evento percorrendo
  uniform vec3 uCorAcento;
  uniform vec3 uCorNeutro;

  varying float vAo;
  varying float vPar;

  void main() {
    // A linha desbota nas pontas: encostar no fragmento com opacidade cheia
    // deixaria a junção dura e denunciaria a geometria.
    float perfil = sin(vAo * 3.14159265);
    float alfa = uOpacidade * (0.28 + perfil * 0.72);

    vec3 cor = uCorNeutro;

    // Pulso percorrendo a conexão: é assim que uma automação disparando fica
    // visível sem virar diagrama explicativo.
    if (uPulso > 0.001) {
      float cabeca = fract(uTempo * 0.42 + vPar * 0.37);
      float dist = abs(vAo - cabeca);
      float brilho = exp(-dist * dist * 220.0) * uPulso;
      cor = mix(cor, uCorAcento, min(brilho * 1.4, 1.0));
      alfa += brilho * 0.85;
    }

    if (alfa < 0.004) discard;
    gl_FragColor = vec4(cor, alfa);
  }
`
