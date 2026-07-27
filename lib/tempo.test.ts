import { describe, it, expect } from 'vitest'
import { formatarTempo, parseTempo } from './tempo'

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
})
