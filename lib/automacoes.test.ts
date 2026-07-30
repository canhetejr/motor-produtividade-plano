import { describe, it, expect } from 'vitest'
import {
  automacaoCasa,
  ordenarAcoes,
  PROFUNDIDADE_MAXIMA,
  EVENTOS,
  ACOES,
  agruparEventos,
  agruparAcoes,
  rotuloEvento,
  rotuloAcao,
} from './automacoes-catalogo'

describe('lib/automacoes', () => {
  describe('automacaoCasa', () => {
    it('exige que o tipo do evento bata', () => {
      const a = { evento: 'cartao_entrou_etapa', evento_config: {} }
      expect(automacaoCasa(a, 'cartao_entrou_etapa')).toBe(true)
      expect(automacaoCasa(a, 'cartao_saiu_etapa')).toBe(false)
    })

    it('config vazia vale para qualquer etapa', () => {
      const a = { evento: 'cartao_entrou_etapa', evento_config: {} }
      expect(automacaoCasa(a, 'cartao_entrou_etapa', { colunaId: 'col-1' })).toBe(true)
      expect(automacaoCasa(a, 'cartao_entrou_etapa', { colunaId: 'col-2' })).toBe(true)
    })

    it('config com colunaId filtra pela etapa', () => {
      const a = { evento: 'cartao_entrou_etapa', evento_config: { colunaId: 'col-1' } }
      expect(automacaoCasa(a, 'cartao_entrou_etapa', { colunaId: 'col-1' })).toBe(true)
      expect(automacaoCasa(a, 'cartao_entrou_etapa', { colunaId: 'col-2' })).toBe(false)
    })

    it('automação presa a uma etapa não dispara quando o evento não diz a etapa', () => {
      // Evento vindo do cron não carrega colunaId; uma automação que pede uma
      // etapa específica não pode disparar "no escuro".
      const a = { evento: 'cartao_entrou_etapa', evento_config: { colunaId: 'col-1' } }
      expect(automacaoCasa(a, 'cartao_entrou_etapa', {})).toBe(false)
    })

    it('config com etiquetaId filtra pela tag', () => {
      const a = { evento: 'tag_adicionada', evento_config: { etiquetaId: 'et-1' } }
      expect(automacaoCasa(a, 'tag_adicionada', { etiquetaId: 'et-1' })).toBe(true)
      expect(automacaoCasa(a, 'tag_adicionada', { etiquetaId: 'et-9' })).toBe(false)
    })

    it('aguenta evento_config nulo vindo do banco', () => {
      const a = { evento: 'play_ativado', evento_config: null }
      expect(automacaoCasa(a, 'play_ativado')).toBe(true)
    })
  })

  describe('ordenarAcoes', () => {
    it('ordena pela coluna ordem', () => {
      const acoes = [
        { id: 'c', ordem: 2 },
        { id: 'a', ordem: 0 },
        { id: 'b', ordem: 1 },
      ]
      expect(ordenarAcoes(acoes).map((a) => a.id)).toEqual(['a', 'b', 'c'])
    })

    it('desempata pelo id para a execução ser determinística', () => {
      const acoes = [
        { id: 'z', ordem: 0 },
        { id: 'a', ordem: 0 },
      ]
      expect(ordenarAcoes(acoes).map((a) => a.id)).toEqual(['a', 'z'])
    })

    it('não muta o array recebido', () => {
      const acoes = [
        { id: 'b', ordem: 1 },
        { id: 'a', ordem: 0 },
      ]
      ordenarAcoes(acoes)
      expect(acoes.map((a) => a.id)).toEqual(['b', 'a'])
    })
  })

  describe('trava anti-loop', () => {
    it('corta antes de virar recursão infinita', () => {
      // Encadear é uso legítimo (mover -> outra automação move de novo), então
      // o teto precisa deixar passar alguns níveis sem permitir ciclo eterno.
      expect(PROFUNDIDADE_MAXIMA).toBeGreaterThanOrEqual(2)
      expect(PROFUNDIDADE_MAXIMA).toBeLessThanOrEqual(5)
    })
  })

  describe('catálogo', () => {
    it('não tem tipo de evento nem de ação repetido', () => {
      expect(new Set(EVENTOS.map((e) => e.tipo)).size).toBe(EVENTOS.length)
      expect(new Set(ACOES.map((a) => a.tipo)).size).toBe(ACOES.length)
    })

    it('agrupa preservando a ordem de declaração', () => {
      expect(agruparEventos().map((g) => g.grupo)).toEqual([
        'Movimentação',
        'Data e horário',
        'Gerenciamento de status',
        'Categorização',
      ])
      expect(agruparAcoes()[0].grupo).toBe('Criação')
    })

    it('todo evento e ação cai em algum grupo', () => {
      const totalEventos = agruparEventos().reduce((s, g) => s + g.itens.length, 0)
      const totalAcoes = agruparAcoes().reduce((s, g) => s + g.itens.length, 0)
      expect(totalEventos).toBe(EVENTOS.length)
      expect(totalAcoes).toBe(ACOES.length)
    })

    it('devolve o próprio tipo quando o rótulo é desconhecido', () => {
      // Automação salva com um tipo que foi removido do catálogo não pode
      // quebrar a tela de listagem.
      expect(rotuloEvento('evento_que_nao_existe')).toBe('evento_que_nao_existe')
      expect(rotuloAcao('acao_que_nao_existe')).toBe('acao_que_nao_existe')
    })

    it('eventos de tempo estão marcados como porCron', () => {
      const porCron = EVENTOS.filter((e) => e.porCron).map((e) => e.tipo)
      expect(porCron).toEqual(['cartao_atrasou', 'cartao_perto_atrasar', 'sla_estourado', 'sla_perto_estourar'])
    })
  })
})
