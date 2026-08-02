import { describe, it, expect } from 'vitest'
import { gerarIcs, escaparTexto, dobrarLinha, type EventoPrazo } from './ics'

const AGORA = new Date('2026-08-02T12:00:00Z')

const base: EventoPrazo = {
  id: 'abc-123',
  codigo: 'KAN-7',
  titulo: 'Revisar roteiro',
  prazo: '2026-08-10',
  quadro: 'Produção',
  coluna: 'Em revisão',
  url: 'https://vertice.teralabs.cloud/kanban/q1?cartao=abc-123',
}

describe('escaparTexto', () => {
  it('escapa os quatro caracteres com significado no RFC 5545', () => {
    // Entrada: a;b,c\d<quebra>e  ->  a\;b\,c\\d\n e
    expect(escaparTexto('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne')
  })

  it('escapa a barra invertida antes dos demais, sem escapar os próprios escapes', () => {
    // Entrada literal: uma barra seguida de ponto e vírgula. A barra vira \\ e o
    // ; vira \; — se a ordem invertesse, a barra do \; seria escapada de novo.
    expect(escaparTexto('\\;')).toBe('\\\\\\;')
  })
})

describe('dobrarLinha', () => {
  it('deixa linha curta intacta', () => {
    expect(dobrarLinha('SUMMARY:curto')).toBe('SUMMARY:curto')
  })

  it('dobra em 75 octetos com espaço de continuação', () => {
    const dobrada = dobrarLinha('X:' + 'a'.repeat(100))
    const partes = dobrada.split('\r\n')
    expect(partes.length).toBe(2)
    expect(Buffer.from(partes[0], 'utf8').length).toBeLessThanOrEqual(75)
    expect(partes[1].startsWith(' ')).toBe(true)
  })

  it('não parte um caractere multibyte ao meio', () => {
    // "ç" ocupa 2 octetos: um corte ingênuo em 75 cairia no meio da sequência.
    const dobrada = dobrarLinha('X:' + 'ç'.repeat(80))
    for (const parte of dobrada.split('\r\n')) {
      expect(parte).not.toContain('�')
    }
    expect(dobrada.replace(/\r\n /g, '')).toBe('X:' + 'ç'.repeat(80))
  })
})

describe('gerarIcs', () => {
  it('produz um calendário válido e vazio quando não há prazo', () => {
    const ics = gerarIcs([], AGORA)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('usa CRLF, exigido pelo RFC', () => {
    const ics = gerarIcs([base], AGORA)
    expect(ics.split('\r\n').length).toBeGreaterThan(10)
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('fecha o evento no dia seguinte porque DTEND é exclusivo', () => {
    // Sem o +1 o prazo aparece um dia antes em vários clientes.
    const ics = gerarIcs([base], AGORA)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260810')
    expect(ics).toContain('DTEND;VALUE=DATE:20260811')
  })

  it('atravessa a virada de mês ao somar o dia', () => {
    const ics = gerarIcs([{ ...base, prazo: '2026-08-31' }], AGORA)
    expect(ics).toContain('DTEND;VALUE=DATE:20260901')
  })

  it('atravessa a virada de ano', () => {
    const ics = gerarIcs([{ ...base, prazo: '2026-12-31' }], AGORA)
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
  })

  it('mantém o UID estável para o mesmo card', () => {
    // É o UID que faz o cliente atualizar em vez de duplicar a cada sync.
    const a = gerarIcs([base], AGORA)
    const b = gerarIcs([base], new Date('2026-09-01T00:00:00Z'))
    expect(a).toContain('UID:cartao-abc-123@vertice')
    expect(b).toContain('UID:cartao-abc-123@vertice')
  })

  it('escapa vírgula vinda do título do card', () => {
    const ics = gerarIcs([{ ...base, titulo: 'Revisar roteiro, versão 2' }], AGORA)
    expect(ics).toContain('roteiro\\, vers')
  })

  it('emite um VEVENT por prazo', () => {
    const ics = gerarIcs([base, { ...base, id: 'def', codigo: 'KAN-8' }], AGORA)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2)
  })
})
