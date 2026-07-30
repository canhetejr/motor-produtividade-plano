import { describe, it, expect } from 'vitest'
import { formatarTempo, parseTempo, somarSegundosSessoes, fatiarSessaoPorDia } from './tempo'

describe('lib/tempo', () => {
  describe('formatarTempo', () => {
    it('retorna "0 min" para valores nulos ou <= 0', () => {
      expect(formatarTempo(null)).toBe('0 min')
      expect(formatarTempo(undefined)).toBe('0 min')
      expect(formatarTempo(0)).toBe('0 min')
      expect(formatarTempo(-10)).toBe('0 min')
    })

    it('retorna minutos formatados quando < 60', () => {
      expect(formatarTempo(1)).toBe('1 min')
      expect(formatarTempo(45)).toBe('45 min')
      expect(formatarTempo(59)).toBe('59 min')
    })

    it('retorna no formato HH:MM quando >= 60', () => {
      expect(formatarTempo(60)).toBe('01:00')
      expect(formatarTempo(90)).toBe('01:30')
      expect(formatarTempo(125)).toBe('02:05')
      expect(formatarTempo(480)).toBe('08:00')
    })
  })

  describe('parseTempo', () => {
    it('retorna null para valores inválidos', () => {
      expect(parseTempo(null)).toBeNull()
      expect(parseTempo('')).toBeNull()
      expect(parseTempo('   ')).toBeNull()
      expect(parseTempo(-5)).toBeNull()
    })

    it('parseia números diretamente', () => {
      expect(parseTempo(90)).toBe(90)
      expect(parseTempo(45.6)).toBe(46)
    })

    it('parseia formato HH:MM ou H:MM', () => {
      expect(parseTempo('01:30')).toBe(90)
      expect(parseTempo('1:30')).toBe(90)
      expect(parseTempo('0:45')).toBe(45)
      expect(parseTempo('02:05')).toBe(125)
    })

    it('parseia formato com "h"', () => {
      expect(parseTempo('1h30')).toBe(90)
      expect(parseTempo('1h 30m')).toBe(90)
      expect(parseTempo('2h')).toBe(120)
    })

    it('parseia números simples ou com sufixo "min"', () => {
      expect(parseTempo('90')).toBe(90)
      expect(parseTempo('45min')).toBe(45)
      expect(parseTempo('  90  ')).toBe(90)
    })
  })

  describe('somarSegundosSessoes', () => {
    it('soma sessões de cronômetro pela diferença dos timestamps', () => {
      expect(
        somarSegundosSessoes([
          { iniciadoEm: '2026-07-30T10:00:00Z', finalizadoEm: '2026-07-30T10:30:00Z', minutos: 30 },
          { iniciadoEm: '2026-07-30T14:00:00Z', finalizadoEm: '2026-07-30T14:00:45Z', minutos: 1 },
        ])
      ).toBe(1800 + 45)
    })

    it('usa o campo minutos quando início e fim são iguais (ajuste manual)', () => {
      // "Ajustar horas registradas" grava o mesmo timestamp nos dois campos:
      // a diferença é zero e só `minutos` carrega o valor real.
      expect(
        somarSegundosSessoes([
          { iniciadoEm: '2026-07-30T09:00:00Z', finalizadoEm: '2026-07-30T09:00:00Z', minutos: 90 },
        ])
      ).toBe(5400)
    })

    it('ignora sessão em aberto', () => {
      expect(
        somarSegundosSessoes([
          { iniciadoEm: '2026-07-30T10:00:00Z', finalizadoEm: null, minutos: null },
          { iniciadoEm: '2026-07-30T08:00:00Z', finalizadoEm: '2026-07-30T08:15:00Z', minutos: 15 },
        ])
      ).toBe(900)
    })

    it('não deixa relógio invertido virar total negativo', () => {
      expect(
        somarSegundosSessoes([
          { iniciadoEm: '2026-07-30T10:00:00Z', finalizadoEm: '2026-07-30T09:00:00Z', minutos: null },
        ])
      ).toBe(0)
    })

    it('devolve 0 para lista vazia', () => {
      expect(somarSegundosSessoes([])).toBe(0)
    })
  })

  describe('fatiarSessaoPorDia', () => {
    // Datas sem sufixo de fuso são interpretadas no fuso local, que é o mesmo
    // referencial de `current_date` usado pelos apontamentos.
    const local = (s: string) => new Date(s)

    it('sessão dentro do mesmo dia vira uma fatia só', () => {
      expect(fatiarSessaoPorDia(local('2026-07-30T09:00:00'), local('2026-07-30T11:30:00'))).toEqual([
        { data: '2026-07-30', minutos: 150 },
      ])
    })

    it('sessão que cruza a meia-noite vira uma fatia por dia', () => {
      // 23h50 → 00h10: 10 min no dia 30, 10 min no dia 31.
      expect(fatiarSessaoPorDia(local('2026-07-30T23:50:00'), local('2026-07-31T00:10:00'))).toEqual([
        { data: '2026-07-30', minutos: 10 },
        { data: '2026-07-31', minutos: 10 },
      ])
    })

    it('funciona na virada de mês', () => {
      expect(fatiarSessaoPorDia(local('2026-07-31T23:30:00'), local('2026-08-01T00:30:00'))).toEqual([
        { data: '2026-07-31', minutos: 30 },
        { data: '2026-08-01', minutos: 30 },
      ])
    })

    it('cobre mais de dois dias (timer esquecido ligado)', () => {
      const fatias = fatiarSessaoPorDia(local('2026-07-30T22:00:00'), local('2026-08-01T02:00:00'))
      expect(fatias).toEqual([
        { data: '2026-07-30', minutos: 120 },
        { data: '2026-07-31', minutos: 1440 },
        { data: '2026-08-01', minutos: 120 },
      ])
    })

    it('soma das fatias bate com a duração total', () => {
      const fatias = fatiarSessaoPorDia(local('2026-07-30T18:15:00'), local('2026-08-01T07:45:00'))
      const total = fatias.reduce((s, f) => s + f.minutos, 0)
      expect(total).toBe(Math.round((new Date('2026-08-01T07:45:00').getTime() - new Date('2026-07-30T18:15:00').getTime()) / 60000))
    })

    it('descarta sessão de segundos (arredonda pra zero minuto)', () => {
      expect(fatiarSessaoPorDia(local('2026-07-30T09:00:00'), local('2026-07-30T09:00:20'))).toEqual([])
    })

    it('descarta fim antes do início e datas inválidas', () => {
      expect(fatiarSessaoPorDia(local('2026-07-30T11:00:00'), local('2026-07-30T09:00:00'))).toEqual([])
      expect(fatiarSessaoPorDia(local('2026-07-30T09:00:00'), local('2026-07-30T09:00:00'))).toEqual([])
      expect(fatiarSessaoPorDia('não é data', local('2026-07-30T09:00:00'))).toEqual([])
    })
  })
})
