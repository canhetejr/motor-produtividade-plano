import { describe, it, expect } from 'vitest'

import { areasFaltantes, chaveArea, lerAreasAprovadas } from './import-areas'

describe('areasFaltantes', () => {
  it('lista o que o arquivo cita e o cadastro não tem', () => {
    const linhas = [
      { area: 'Auxiliar', nome: 'Agendar Gravações' },
      { area: 'Qualidade EAD', nome: 'Banco de Questões' },
      { area: 'Produção', nome: 'Briefing' },
    ]
    expect(areasFaltantes(linhas, ['Produção'])).toEqual(['Auxiliar', 'Qualidade EAD'])
  })

  it('compara sem caixa e sem espaço nas pontas', () => {
    expect(areasFaltantes([{ area: '  produção  ' }], ['Produção'])).toEqual([])
  })

  it('não repete a mesma área citada em várias linhas', () => {
    const linhas = [{ area: 'Auxiliar' }, { area: 'auxiliar' }, { area: 'AUXILIAR' }]
    // Devolve na grafia da primeira aparição: é ela que vira o cadastro.
    expect(areasFaltantes(linhas, [])).toEqual(['Auxiliar'])
  })

  it('ignora linha sem área', () => {
    expect(areasFaltantes([{ area: '' }, { nome: 'Sem coluna' }], [])).toEqual([])
  })
})

describe('lerAreasAprovadas', () => {
  // A distinção que o fluxo inteiro depende: "ainda não perguntei" (null) não
  // pode ser confundido com "perguntei e a resposta foi nenhuma" (lista vazia).
  it('separa ausência de resposta de resposta vazia', () => {
    expect(lerAreasAprovadas(null)).toBeNull()
    expect(lerAreasAprovadas(undefined)).toBeNull()
    expect(lerAreasAprovadas('[]')).toEqual(new Set())
  })

  it('normaliza os nomes aprovados', () => {
    const aprovadas = lerAreasAprovadas('["Auxiliar", "  Qualidade EAD "]')
    expect(aprovadas?.has(chaveArea('auxiliar'))).toBe(true)
    expect(aprovadas?.has(chaveArea('Qualidade EAD'))).toBe(true)
    expect(aprovadas?.has(chaveArea('Produção'))).toBe(false)
  })

  it('trata entrada corrompida como ausência de resposta', () => {
    // Melhor perguntar de novo do que criar área a partir de lixo.
    expect(lerAreasAprovadas('não é json')).toBeNull()
    expect(lerAreasAprovadas('{"a":1}')).toBeNull()
  })
})
