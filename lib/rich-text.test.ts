import { describe, it, expect } from 'vitest'
import { sanitizarHtml, textoParaHtml, htmlParaTexto, ehHtml, htmlVazio } from './rich-text'

describe('sanitizarHtml — o que precisa NÃO passar', () => {
  // O vetor real: `submeterFormulario` grava resposta de visitante deslogado
  // em cartoes.descricao, e um gestor abre esse card depois.
  it('descarta <script>', () => {
    const r = sanitizarHtml('<p>oi</p><script>alert(1)</script>')
    expect(r).not.toContain('script')
    expect(r).toContain('oi')
  })

  it('descarta handler inline em tag permitida', () => {
    const r = sanitizarHtml('<p onclick="alert(1)">texto</p>')
    expect(r).not.toContain('onclick')
    expect(r).toContain('texto')
  })

  it('descarta <img onerror>', () => {
    const r = sanitizarHtml('<p><img src=x onerror="alert(1)"></p>')
    expect(r).not.toContain('onerror')
    expect(r).not.toContain('<img')
  })

  it('recusa href javascript:', () => {
    const r = sanitizarHtml('<p><a href="javascript:alert(1)">clique</a></p>')
    expect(r).not.toContain('javascript:')
    expect(r).toContain('clique') // o texto fica, só o link cai
  })

  it('recusa href data:', () => {
    const r = sanitizarHtml('<p><a href="data:text/html,<script>alert(1)</script>">x</a></p>')
    expect(r).not.toContain('data:text/html')
  })

  it('descarta <iframe>', () => {
    expect(sanitizarHtml('<p>a</p><iframe src="https://evil.tld"></iframe>')).not.toContain('iframe')
  })

  it('descarta <style>', () => {
    expect(sanitizarHtml('<p>a</p><style>body{display:none}</style>')).not.toContain('style>')
  })
})

describe('sanitizarHtml — o que precisa passar', () => {
  it('preserva link http/https com rel e target de segurança', () => {
    const r = sanitizarHtml('<p><a href="https://docs.google.com/x">planilha</a></p>')
    expect(r).toContain('https://docs.google.com/x')
    expect(r).toContain('planilha')
    expect(r).toContain('noopener')
  })

  it('preserva mailto', () => {
    expect(sanitizarHtml('<p><a href="mailto:a@b.com">e-mail</a></p>')).toContain('mailto:a@b.com')
  })

  it('preserva a formatação que a barra produz', () => {
    const original =
      '<h2>Título</h2><p><strong>negrito</strong> <em>itálico</em> <s>riscado</s></p>' +
      '<ul><li><p>um</p></li></ul><ol><li><p>dois</p></li></ol>' +
      '<blockquote><p>citação</p></blockquote><pre><code>codigo()</code></pre>'
    const r = sanitizarHtml(original)
    for (const t of ['<h2>', '<strong>', '<em>', '<s>', '<ul>', '<ol>', '<blockquote>', '<pre>']) {
      expect(r).toContain(t)
    }
  })

  it('é idempotente — sanitizar de novo não degrada', () => {
    const uma = sanitizarHtml('<h2>T</h2><p><strong>a</strong></p><ul><li><p>x</p></li></ul>')
    expect(sanitizarHtml(uma)).toBe(uma)
  })

  it('converte texto puro legado em parágrafos escapados', () => {
    // Descrição vinda do formulário público hoje: texto com \n.
    const r = sanitizarHtml('Enviado via formulário\n\nCampo: <b>valor</b>')
    expect(r).toContain('&lt;b&gt;')
    expect(r).not.toContain('<b>')
  })

  it('não derruba a tela com entrada malformada', () => {
    expect(() => sanitizarHtml('<p>aberto <div><span>')).not.toThrow()
  })

  /**
   * Distinção sutil, e por isso travada aqui: quando o ataque chega como TEXTO
   * (formulário público), o certo é ele continuar VISÍVEL e inerte — o card
   * deve mostrar o que a pessoa digitou. Procurar a substring "onerror" na
   * saída dá falso positivo, porque ela aparece escapada, como texto. O que
   * importa é que nenhuma TAG real perigosa exista.
   */
  it('payload em texto puro vira conteúdo visível, não marcação', () => {
    const hostil = 'Nome: <script>roubar()</script>\n\nObs: <img src=x onerror=alert(1)>'
    const r = sanitizarHtml(textoParaHtml(hostil))

    // Continua legível para quem abre o card.
    expect(htmlParaTexto(r)).toContain('<script>roubar()</script>')

    // Mas as únicas tags de verdade são as do editor.
    const tags = [...r.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase())
    expect(new Set(tags)).toEqual(new Set(['p']))
    expect(r).not.toMatch(/<script/i)
    expect(r).not.toMatch(/<img/i)
  })
})

describe('textoParaHtml', () => {
  it('escapa os caracteres que viram marcação', () => {
    const r = textoParaHtml('a < b & c > d "aspas"')
    expect(r).toContain('&lt;')
    expect(r).toContain('&amp;')
    expect(r).toContain('&gt;')
    expect(r).not.toMatch(/<(?!\/?p>)/)
  })

  it('separa parágrafos em linha dupla e mantém quebra simples', () => {
    expect(textoParaHtml('um\ndois\n\ntres')).toBe('<p>um<br>dois</p><p>tres</p>')
  })

  // Descrição vinda de navegador Windows chega com \r\n. Sem normalizar, o
  // "\r\n\r\n" não casava como quebra de parágrafo: virava um bloco só, com \r
  // sobrando no meio. Há cards assim no banco, criados pelo formulário público.
  it('trata CRLF igual a LF', () => {
    expect(textoParaHtml('um\r\ndois')).toBe('<p>um<br>dois</p>')
    expect(textoParaHtml('um\r\n\r\ndois')).toBe('<p>um</p><p>dois</p>')
    expect(textoParaHtml('um\r\n\r\ndois')).not.toContain('\r')
  })

  it('devolve vazio para nulo, vazio e só espaços', () => {
    expect(textoParaHtml(null)).toBe('')
    expect(textoParaHtml('')).toBe('')
    expect(textoParaHtml('   \n  ')).toBe('')
  })
})

describe('htmlParaTexto', () => {
  // A regressão silenciosa que isto evita: a busca do quadro faz
  // includes(termo) na descrição, então tag virava resultado de busca.
  it('não deixa nome de tag virar texto pesquisável', () => {
    const t = htmlParaTexto('<p>moodle</p><p>ingressante</p>')
    expect(t).toBe('moodle ingressante')
    expect(t).not.toContain('p')  // "p" só existiria vindo de tag
  })

  it('separa blocos com espaço em vez de colar palavras', () => {
    expect(htmlParaTexto('<li>um</li><li>dois</li>')).toBe('um dois')
    expect(htmlParaTexto('<p>a</p><p>b</p>')).toBe('a b')
  })

  it('resolve entidades sem recriar marcação', () => {
    expect(htmlParaTexto('<p>a &amp; b</p>')).toBe('a & b')
    // "&amp;lt;" é o literal "&lt;", não o caractere "<".
    expect(htmlParaTexto('<p>&amp;lt;</p>')).toBe('&lt;')
  })

  it('ignora conteúdo de script', () => {
    expect(htmlParaTexto('<p>ok</p><script>roubar()</script>')).toBe('ok')
  })
})

describe('ehHtml e htmlVazio', () => {
  it('reconhece HTML do editor e texto puro legado', () => {
    expect(ehHtml('<p>x</p>')).toBe(true)
    expect(ehHtml('<h2>x</h2>')).toBe(true)
    expect(ehHtml('Enviado via formulário')).toBe(false)
    expect(ehHtml('a < b')).toBe(false)
  })

  it('trata o parágrafo vazio que o editor deixa como vazio', () => {
    // Sem isto, todo card salvo sem descrição mostraria o ícone de "tem
    // descrição" no quadro.
    expect(htmlVazio('<p></p>')).toBe(true)
    expect(htmlVazio('<p><br></p>')).toBe(true)
    expect(htmlVazio('')).toBe(true)
    expect(htmlVazio(null)).toBe(true)
    expect(htmlVazio('<p>tem conteúdo</p>')).toBe(false)
  })
})
