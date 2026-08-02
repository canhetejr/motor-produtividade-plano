import { describe, it, expect } from 'vitest'
import {
  diaSemanaIso,
  devesSair,
  destinatariosDe,
  escopoDe,
  type Agendamento,
  type Pessoa,
} from './relatorios-agendados'

const agendamento = (over: Partial<Agendamento> = {}): Agendamento => ({
  id: 'r1',
  nome: 'Semanal',
  janelaDiasUteis: 5,
  diaSemana: 1,
  areaId: null,
  ativo: true,
  destinatarios: [],
  ...over,
})

const pessoas: Pessoa[] = [
  { id: 'g1', role: 'gestor', areaId: 'a1', aceitaRelatorio: true },
  { id: 'g2', role: 'gestor', areaId: 'a2', aceitaRelatorio: false },
  { id: 'c1', role: 'colaborador', areaId: 'a1', aceitaRelatorio: true },
  { id: 'c2', role: 'colaborador', areaId: 'a2', aceitaRelatorio: true },
]

describe('diaSemanaIso', () => {
  it('devolve 1 para segunda e 7 para domingo', () => {
    expect(diaSemanaIso('2026-08-03')).toBe(1) // segunda
    expect(diaSemanaIso('2026-08-02')).toBe(7) // domingo
  })

  it('não muda de dia por causa de fuso', () => {
    // Lida como instante local, esta data viraria o dia anterior no Brasil.
    expect(diaSemanaIso('2026-08-03')).toBe(1)
  })
})

describe('devesSair', () => {
  it('sai no dia configurado', () => {
    expect(devesSair(agendamento({ diaSemana: 1 }), '2026-08-03')).toBe(true)
  })

  it('não sai em outro dia', () => {
    expect(devesSair(agendamento({ diaSemana: 1 }), '2026-08-04')).toBe(false)
  })

  it('agendamento inativo nunca sai', () => {
    expect(devesSair(agendamento({ ativo: false }), '2026-08-03')).toBe(false)
  })
})

describe('destinatariosDe', () => {
  it('sem lista explícita, vai para os gestores', () => {
    // Comportamento de hoje, e o padrão seguro: um agendamento salvo pela
    // metade manda para quem já recebia em vez de não mandar para ninguém.
    expect(destinatariosDe(agendamento(), pessoas)).toEqual(['g1'])
  })

  it('respeita a lista explícita', () => {
    expect(destinatariosDe(agendamento({ destinatarios: ['c1', 'c2'] }), pessoas).sort()).toEqual([
      'c1',
      'c2',
    ])
  })

  it('a preferência individual vence a lista explícita', () => {
    // Quem desligou o relatório desligou de verdade; listar a pessoa num
    // agendamento não pode reativar aviso que ela recusou.
    expect(destinatariosDe(agendamento({ destinatarios: ['g2'] }), pessoas)).toEqual([])
  })

  it('ignora id de pessoa que não existe mais', () => {
    expect(destinatariosDe(agendamento({ destinatarios: ['fantasma'] }), pessoas)).toEqual([])
  })

  it('não manda para gestor que desligou a preferência', () => {
    expect(destinatariosDe(agendamento(), pessoas)).not.toContain('g2')
  })
})

describe('escopoDe', () => {
  it('sem área, mede a equipe inteira', () => {
    expect(escopoDe(agendamento(), pessoas)).toHaveLength(4)
  })

  it('com área, mede só quem é dela', () => {
    expect(escopoDe(agendamento({ areaId: 'a1' }), pessoas).map((p) => p.id)).toEqual(['g1', 'c1'])
  })

  it('área sem ninguém devolve lista vazia em vez de todo mundo', () => {
    expect(escopoDe(agendamento({ areaId: 'inexistente' }), pessoas)).toEqual([])
  })
})
