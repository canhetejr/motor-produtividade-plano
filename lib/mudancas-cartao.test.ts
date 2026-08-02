import { describe, it, expect } from 'vitest'
import { descreverMudancas, resumirMudancas } from './mudancas-cartao'

describe('descreverMudancas', () => {
  it('não relata nada quando nada mudou', () => {
    const c = { prazo: '2026-08-10', prioridade: 'alta' }
    expect(descreverMudancas(c, c)).toEqual([])
  })

  it('relata mudança de prioridade com o rótulo legível', () => {
    expect(descreverMudancas({ prioridade: 'baixa' }, { prioridade: 'alta' })).toEqual([
      'Alterou prioridade: Baixa → Alta.',
    ])
  })

  it('formata data no padrão brasileiro', () => {
    const [frase] = descreverMudancas({ prazo: '2026-08-10' }, { prazo: '2026-08-11' })
    expect(frase).toBe('Alterou entrega desejada: 10/08/2026 → 11/08/2026.')
  })

  it('não erra o dia por causa de fuso', () => {
    // Sem o 'T00:00:00' a string curta é lida como UTC e vira o dia anterior.
    const [frase] = descreverMudancas({ prazo: null }, { prazo: '2026-01-01' })
    expect(frase).toContain('01/01/2026')
  })

  it('trata null, undefined e string vazia como o mesmo "vazio"', () => {
    // Sem isso, um formulário que devolve '' onde havia null geraria um evento
    // de "mudou de vazio para vazio" a cada salvamento.
    expect(descreverMudancas({ prazo: null }, { prazo: '' })).toEqual([])
    expect(descreverMudancas({ prazo: undefined }, { prazo: null })).toEqual([])
  })

  it('não relata mudança quando só o tipo do valor difere', () => {
    // O formulário devolve número como string: 120 !== '120' geraria evento a
    // cada salvamento sem alteração nenhuma.
    expect(
      descreverMudancas({ tempoEstimadoMin: 120 }, { tempoEstimadoMin: '120' as unknown as number })
    ).toEqual([])
  })

  it('relata preenchimento de campo antes vazio', () => {
    expect(descreverMudancas({ prazo: null }, { prazo: '2026-08-10' })).toEqual([
      'Alterou entrega desejada: vazio → 10/08/2026.',
    ])
  })

  it('relata limpeza de campo', () => {
    expect(descreverMudancas({ prazo: '2026-08-10' }, { prazo: null })).toEqual([
      'Alterou entrega desejada: 10/08/2026 → vazio.',
    ])
  })

  it('não despeja o título antigo na frase', () => {
    // Título longo tornaria o histórico ilegível, e o novo já está no cabeçalho.
    const frases = descreverMudancas({ titulo: 'Antigo bem comprido' }, { titulo: 'Novo' })
    expect(frases).toEqual(['Renomeou o card.'])
  })

  it('acumula várias mudanças na ordem dos campos', () => {
    const frases = descreverMudancas(
      { prazo: '2026-08-10', prioridade: 'baixa' },
      { prazo: '2026-08-12', prioridade: 'alta' }
    )
    expect(frases).toHaveLength(2)
  })

  it('formata estimativa com unidade', () => {
    const [frase] = descreverMudancas({ tempoEstimadoMin: 60 }, { tempoEstimadoMin: 90 })
    expect(frase).toBe('Alterou estimativa: 60 min → 90 min.')
  })
})

describe('resumirMudancas', () => {
  it('devolve null quando nada mudou', () => {
    expect(resumirMudancas({ prazo: '2026-08-10' }, { prazo: '2026-08-10' })).toBeNull()
  })

  it('junta as frases numa linha só', () => {
    const r = resumirMudancas({ prioridade: 'baixa', tipo: 'Padrão' }, { prioridade: 'alta', tipo: 'Bug' })
    expect(r).toBe('Alterou prioridade: Baixa → Alta. Alterou tipo: Padrão → Bug.')
  })
})
