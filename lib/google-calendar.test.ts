import { afterEach, describe, expect, it } from 'vitest'

import { montarEventoGoogle } from './google-calendar-payload'

describe('evento do Google Calendar', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('leva contexto operacional e link direto do card para o calendário', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://vertice.example/'

    const evento = montarEventoGoogle({
      id: 'card-1',
      codigo: 'MOODLE-20',
      titulo: 'Teste Calendário',
      descricao: '<p>Validar o material &amp; os anexos.</p>',
      prazo: '2026-08-05',
      prioridade: 'alta',
      tipo: 'Padrão',
      tag_referencia: 'TURMA-1',
      tempo_estimado_min: 90,
      updated_at: '2026-08-04T12:00:00.000Z',
      demanda: { nome: 'Gestão de Moodle' },
      coluna: { nome: 'Triagem', quadro_id: 'board-1', quadro: { nome: 'Operação EAD – Moodle' } },
    }, {
      responsaveis: ['Luiz Fernando'],
      etiquetas: ['Urgente'],
      checklist: { total: 3, concluidos: 1 },
    })

    expect(evento.summary).toBe('[MOODLE-20] Teste Calendário')
    expect(evento.start).toEqual({ date: '2026-08-05' })
    expect(evento.end).toEqual({ date: '2026-08-06' })
    expect(evento.description).toContain('Validar o material & os anexos.')
    expect(evento.description).toContain('Quadro: Operação EAD – Moodle')
    expect(evento.description).toContain('Etapa: Triagem')
    expect(evento.description).toContain('Demanda: Gestão de Moodle')
    expect(evento.description).toContain('Prioridade: Alta')
    expect(evento.description).toContain('Responsáveis: Luiz Fernando')
    expect(evento.description).toContain('Checklist: 1 de 3 concluídos')
    expect(evento.description).toContain('Abrir demanda no Vértice: https://vertice.example/kanban/board-1?cartao=card-1')
    expect(evento.extendedProperties.private.vertice_card_id).toBe('card-1')
  })
})
