import { describe, it, expect } from 'vitest'
import { resolverMencoes } from './mencoes'

const membros = [
  { id: 'ana', nome: 'Ana' },
  { id: 'ana-paula', nome: 'Ana Paula' },
  { id: 'jose', nome: 'José Carlos' },
  { id: 'bia', nome: 'Beatriz' },
]

describe('resolverMencoes', () => {
  it('devolve vazio sem nenhuma arroba', () => {
    expect(resolverMencoes('<p>comentário comum</p>', membros)).toEqual([])
  })

  it('encontra uma menção simples', () => {
    expect(resolverMencoes('<p>@Beatriz pode olhar?</p>', membros)).toEqual(['bia'])
  })

  it('casa o nome mais longo, não o prefixo', () => {
    // Com "Ana" e "Ana Paula" na equipe, @Ana Paula é a Ana Paula.
    expect(resolverMencoes('<p>@Ana Paula revisa</p>', membros)).toEqual(['ana-paula'])
  })

  it('ainda encontra o nome curto quando é ele mesmo', () => {
    expect(resolverMencoes('<p>@Ana revisa</p>', membros)).toEqual(['ana'])
  })

  it('não casa nome que apenas começa igual', () => {
    // "Anabela" não é "Ana".
    expect(resolverMencoes('<p>@Anabela</p>', membros)).toEqual([])
  })

  it('ignora acento na escrita da menção', () => {
    // Depender do acento faria a menção falhar em quem digita sem.
    expect(resolverMencoes('<p>@Jose Carlos</p>', membros)).toEqual(['jose'])
    expect(resolverMencoes('<p>@José Carlos</p>', membros)).toEqual(['jose'])
  })

  it('ignora diferença de maiúscula', () => {
    expect(resolverMencoes('<p>@beatriz</p>', membros)).toEqual(['bia'])
  })

  it('atravessa a formatação do editor', () => {
    // Sem extrair o texto, <strong>@Beatriz</strong> não casaria.
    expect(resolverMencoes('<p><strong>@Beatriz</strong> olha isso</p>', membros)).toEqual(['bia'])
  })

  it('não casa nome que só existe em atributo', () => {
    // O texto puro do link é "veja", não "@Beatriz".
    expect(resolverMencoes('<p><a href="#" title="@Beatriz">veja</a></p>', membros)).toEqual([])
  })

  it('não duplica quem foi mencionado duas vezes', () => {
    expect(resolverMencoes('<p>@Ana e de novo @Ana</p>', membros)).toEqual(['ana'])
  })

  it('encontra várias pessoas', () => {
    const ids = resolverMencoes('<p>@Ana e @Beatriz</p>', membros).sort()
    expect(ids).toEqual(['ana', 'bia'])
  })

  it('ignora arroba de e-mail, que não começa nome', () => {
    // "ana@empresa.com": a arroba está colada no fim de uma palavra; o padrão
    // captura "empresa.com", que não é membro.
    expect(resolverMencoes('<p>manda pra ana@empresa.com</p>', membros)).toEqual([])
  })

  it('não quebra com lista de membros vazia', () => {
    expect(resolverMencoes('<p>@Ana</p>', [])).toEqual([])
  })
})
