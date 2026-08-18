import { describe, it, expect } from 'vitest'
import {
  automacaoCasa,
  ordenarAcoes,
  ancoraDedupe,
  faltaNaAcao,
  PROFUNDIDADE_MAXIMA,
  EVENTOS,
  ACOES,
  ACAO_POR_TIPO,
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

  describe('ancoraDedupe', () => {
    it('todo evento de cron tem âncora', () => {
      // Um evento de cron sem âncora redispara a cada varredura: um card
      // atrasado mandaria e-mail (ou criaria subtarefa) todo dia, pra sempre.
      // Este teste é a rede de proteção pra quando um evento novo por cron
      // for adicionado ao catálogo.
      for (const evento of EVENTOS.filter((e) => e.porCron)) {
        expect(ancoraDedupe(evento.tipo), `evento por cron sem âncora: ${evento.tipo}`).not.toBeNull()
      }
    })

    it('SLA ancora na etapa e prazo ancora na edição', () => {
      // SLA zera quando o card muda de coluna; prazo zera quando o card é
      // editado (é o sinal disponível de que a data pode ter mudado).
      expect(ancoraDedupe('sla_estourado')).toBe('etapa')
      expect(ancoraDedupe('sla_perto_estourar')).toBe('etapa')
      expect(ancoraDedupe('cartao_atrasou')).toBe('edicao')
      expect(ancoraDedupe('cartao_perto_atrasar')).toBe('edicao')
    })

    it('evento disparado por mutação não deduplica', () => {
      // Mover o card duas vezes tem que rodar a automação duas vezes.
      for (const evento of EVENTOS.filter((e) => !e.porCron)) {
        expect(ancoraDedupe(evento.tipo), `evento pontual com âncora: ${evento.tipo}`).toBeNull()
      }
    })
  })

  describe('faltaNaAcao', () => {
    it('cobre toda forma de configuração do catálogo', () => {
      // Rede de proteção pra ação nova: se alguém acrescentar uma forma de
      // config sem ensinar a validação, a ação passaria a ser salva pela
      // metade e só quebraria no executor, num card real.
      const formas = new Set(ACOES.map((a) => ACAO_POR_TIPO.get(a.tipo)?.config))
      for (const forma of formas) {
        if (forma === 'nenhuma') continue
        const acao = ACOES.find((a) => a.config === forma)!
        expect(faltaNaAcao(acao.tipo, {}), `forma sem validação: ${forma}`).not.toBeNull()
      }
    })

    it('ação sem configuração extra está sempre completa', () => {
      for (const acao of ACOES.filter((a) => a.config === 'nenhuma')) {
        expect(faltaNaAcao(acao.tipo, {})).toBeNull()
      }
    })

    it('exige o campo que o executor exigiria', () => {
      expect(faltaNaAcao('criar_tarefa', {})).toMatch(/título/i)
      expect(faltaNaAcao('criar_tarefa', { titulo: 'Revisar' })).toBeNull()

      expect(faltaNaAcao('mover_cartao', {})).toMatch(/etapa/i)
      expect(faltaNaAcao('mover_cartao', { colunaId: 'col-1' })).toBeNull()

      expect(faltaNaAcao('adicionar_responsavel', {})).toMatch(/pessoa/i)
      expect(faltaNaAcao('adicionar_responsavel', { colaboradorId: 'c-1' })).toBeNull()

      expect(faltaNaAcao('enviar_email', {})).toMatch(/destinat/i)
      expect(faltaNaAcao('enviar_email', { destinatario: '{{emails_alocados}}' })).toBeNull()
    })

    it('trata só-espaços como vazio', () => {
      // "   " passaria num teste de string vazia e viraria título vazio no
      // insert, que é NOT NULL.
      expect(faltaNaAcao('criar_tarefa', { titulo: '   ' })).not.toBeNull()
    })

    it('alterar_campo aceita campo fixo ou customizado, e valor vazio', () => {
      expect(faltaNaAcao('alterar_campo', {})).toMatch(/campo/i)
      // Valor vazio é legítimo: é assim que se limpa o campo.
      expect(faltaNaAcao('alterar_campo', { campo: 'prioridade' })).toBeNull()
      expect(faltaNaAcao('alterar_campo', { campoId: 'cc-1' })).toBeNull()
    })

    it('ação desconhecida não é reprovada aqui', () => {
      // Tipo fora do catálogo já é barrado pelo schema da action; aqui ele não
      // pode virar um erro de "campo faltando" sem sentido.
      expect(faltaNaAcao('acao_que_nao_existe', {})).toBeNull()
    })
  })
})
