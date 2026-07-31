import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  aplicarVariaveis,
  chaveDeRotulo,
  contemVariaveis,
  inserirVariavel,
  segmentar,
  token,
  variaveisDeCampos,
  variaveisDoFormulario,
  variaveisUsadas,
  VARIAVEIS_CARTAO,
  VARIAVEIS_FORMULARIO_FIXAS,
} from './variaveis'

describe('lib/variaveis', () => {
  describe('aplicarVariaveis', () => {
    it('troca o token pelo valor', () => {
      expect(aplicarVariaveis('Card {{titulo}} entregue', { titulo: 'Landing page' })).toBe(
        'Card Landing page entregue'
      )
    })

    it('troca todas as ocorrências da mesma variável', () => {
      expect(aplicarVariaveis('{{codigo}} — {{codigo}}', { codigo: 'UX-1' })).toBe('UX-1 — UX-1')
    })

    it('tolera espaço dentro das chaves', () => {
      // Quem digita à mão escreve assim; o menu nunca gera com espaço.
      expect(aplicarVariaveis('{{ titulo }}', { titulo: 'X' })).toBe('X')
    })

    it('chave conhecida sem valor some do texto', () => {
      // Card sem prazo: a frase fica "Vence em ." e não "Vence em {{prazo}}".
      expect(aplicarVariaveis('Vence em {{prazo}}.', { prazo: '' })).toBe('Vence em .')
    })

    it('deixa o token cru quando a chave não existe', () => {
      // Erro de digitação precisa aparecer: apagar em silêncio esconderia a
      // causa de um e-mail com frase faltando.
      expect(aplicarVariaveis('Oi {{titulo_}}', { titulo: 'X' })).toBe('Oi {{titulo_}}')
    })

    it('não interpreta o valor como novo token', () => {
      // Resposta de formulário público é texto de visitante deslogado: se o
      // valor virasse template, daria pra ler qualquer variável do contexto.
      expect(aplicarVariaveis('{{a}}', { a: '{{b}}', b: 'segredo' })).toBe('{{b}}')
    })

    it('texto vazio ou nulo vira string vazia', () => {
      expect(aplicarVariaveis(null, {})).toBe('')
      expect(aplicarVariaveis(undefined, {})).toBe('')
    })
  })

  describe('variaveisUsadas', () => {
    it('lista sem repetir e olha todos os textos', () => {
      expect(variaveisUsadas('{{titulo}} {{titulo}}', 'x {{prazo}}').sort()).toEqual(['prazo', 'titulo'])
    })

    it('ignora texto sem variável', () => {
      expect(variaveisUsadas('nada aqui', null, undefined)).toEqual([])
      expect(contemVariaveis('nada aqui')).toBe(false)
    })
  })

  describe('segmentar', () => {
    it('remonta o texto original exatamente', () => {
      // O realce desenha os segmentos POR CIMA do campo: um caractere a mais
      // ou a menos desalinha todos os chips seguintes.
      const texto = 'Olá {{criada_por}}, o card {{codigo}} venceu {{inexistente}}!'
      const segmentos = segmentar(texto, VARIAVEIS_CARTAO)
      expect(segmentos.map((s) => s.texto).join('')).toBe(texto)
    })

    it('marca como desconhecida a chave fora do catálogo', () => {
      const segmentos = segmentar('{{titulo}} {{xpto}}', VARIAVEIS_CARTAO)
      const variaveis = segmentos.filter((s) => s.tipo === 'variavel')
      expect(variaveis).toHaveLength(2)
      expect(variaveis[0].tipo === 'variavel' && variaveis[0].rotulo).toBe('Título')
      expect(variaveis[1].tipo === 'variavel' && variaveis[1].rotulo).toBeNull()
    })
  })

  describe('inserirVariavel', () => {
    it('insere na posição do cursor', () => {
      expect(inserirVariavel('Ola !', 4, 4, 'titulo')).toEqual({
        texto: 'Ola {{titulo}}!',
        cursor: 4 + '{{titulo}}'.length,
      })
    })

    it('substitui a seleção', () => {
      expect(inserirVariavel('Ola mundo', 4, 9, 'titulo').texto).toBe('Ola {{titulo}}')
    })

    it('aguenta índice fora do texto', () => {
      // selectionStart guardado antes de um `onChange` externo pode passar do fim.
      expect(inserirVariavel('abc', 99, 99, 'titulo').texto).toBe(`abc${token('titulo')}`)
    })
  })

  describe('chaveDeRotulo', () => {
    it('tira acento, caixa e pontuação', () => {
      expect(chaveDeRotulo('Endereço de E-mail')).toBe('endereco_de_e_mail')
      expect(chaveDeRotulo('  Qual é o setor?  ')).toBe('qual_e_o_setor')
    })

    it('nunca devolve vazio', () => {
      // Pergunta ainda sem rótulo no builder não pode gerar `{{}}`.
      expect(chaveDeRotulo('???')).toBe('campo')
      expect(chaveDeRotulo('')).toBe('campo')
    })

    it('só produz caracteres aceitos pela gramática do token', () => {
      const chave = chaveDeRotulo('Ação — 100% (urgente)!')
      expect(chave).toMatch(/^[a-z0-9_]+$/)
      expect(aplicarVariaveis(token(chave), { [chave]: 'ok' })).toBe('ok')
    })
  })

  describe('variaveisDeCampos', () => {
    it('mantém a ordem dos campos — o servidor casa resposta e chave por índice', () => {
      const campos = [{ rotulo: 'Nome' }, { rotulo: 'Setor' }]
      expect(variaveisDeCampos(campos).map((v) => v.chave)).toEqual(['nome', 'setor'])
    })

    it('desempata rótulos que reduzem à mesma chave', () => {
      // "E-mail" e "E mail" viram `e_mail`: sem sufixo, a segunda resposta
      // sobrescreveria a primeira sem ninguém perceber.
      const chaves = variaveisDeCampos([{ rotulo: 'E-mail' }, { rotulo: 'E mail' }, { rotulo: 'E@mail' }]).map(
        (v) => v.chave
      )
      expect(chaves).toEqual(['e_mail', 'e_mail_2', 'e_mail_3'])
      expect(new Set(chaves).size).toBe(3)
    })

    it('inclui as fixas depois das perguntas', () => {
      const todas = variaveisDoFormulario([{ rotulo: 'Nome' }])
      expect(todas.map((v) => v.chave)).toEqual(['nome', ...VARIAVEIS_FORMULARIO_FIXAS.map((v) => v.chave)])
    })
  })

  describe('catálogo do card', () => {
    it('não repete chave e todas seguem a gramática do token', () => {
      const chaves = VARIAVEIS_CARTAO.map((v) => v.chave)
      expect(new Set(chaves).size).toBe(chaves.length)
      for (const chave of chaves) expect(chave).toMatch(/^[a-z0-9_]+$/)
    })

    it('toda variável do menu é resolvida pelo servidor', () => {
      // Leitura de texto porque lib/variaveis-cartao.ts é 'server-only' e não
      // pode ser importado aqui. Grosseiro, mas pega exatamente a falha que
      // importa: variável nova no catálogo, esquecida no resolvedor — ela
      // apareceria no menu e sairia vazia no e-mail, sem erro nenhum.
      const fonte = readFileSync(new URL('./variaveis-cartao.ts', import.meta.url), 'utf8')
      for (const { chave } of VARIAVEIS_CARTAO) {
        expect(fonte, `variável sem resolução no servidor: ${chave}`).toContain(`'${chave}'`)
      }
    })
  })
})
