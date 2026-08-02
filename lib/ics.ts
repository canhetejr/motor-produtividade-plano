/**
 * Geração de arquivo iCalendar (RFC 5545) para os prazos do Kanban.
 *
 * Escrito à mão, sem dependência: o formato é simples e o app já carrega
 * biblioteca demais no bundle. Nada disto roda no cliente — é só no route
 * handler —, mas uma dependência a mais é uma dependência a mais para auditar.
 */

export type EventoPrazo = {
  id: string
  codigo: string
  titulo: string
  /** ISO `YYYY-MM-DD`. */
  prazo: string
  quadro: string
  coluna: string
  url: string
}

/**
 * RFC 5545 §3.3.11: barra invertida, ponto e vírgula, vírgula e quebra de linha
 * têm significado no formato e precisam ser escapados no texto. A ordem importa
 * — a barra tem que vir primeiro, senão escapa os escapes recém-inseridos.
 */
export function escaparTexto(valor: string): string {
  return valor
    .replace(/\\/g, '\\\\')
    // '\\;' e não '\;': em literal JavaScript `\;` não é sequência de escape e o
    // parser simplesmente descarta a barra — o ponto e vírgula saía sem escapar,
    // quebrando o campo para qualquer título que contivesse um.
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * RFC 5545 §3.1: linha de no máximo 75 octetos; o resto continua na linha
 * seguinte começando por um espaço. Clientes rigorosos (Outlook) rejeitam o
 * arquivo inteiro quando a linha estoura.
 *
 * O corte é por octeto e não por caractere: "ç" ocupa dois em UTF-8, e cortar no
 * meio da sequência produz byte inválido.
 */
export function dobrarLinha(linha: string): string {
  const bytes = Buffer.from(linha, 'utf8')
  if (bytes.length <= 75) return linha

  const partes: string[] = []
  let inicio = 0
  // 75 na primeira linha; nas seguintes 74, porque o espaço inicial conta.
  let limite = 75
  while (inicio < bytes.length) {
    let fim = Math.min(inicio + limite, bytes.length)
    // Recua até o começo de um caractere: 10xxxxxx é byte de continuação.
    while (fim < bytes.length && (bytes[fim] & 0xc0) === 0x80) fim--
    partes.push(bytes.subarray(inicio, fim).toString('utf8'))
    inicio = fim
    limite = 74
  }
  return partes.join('\r\n ')
}

/** `YYYY-MM-DD` -> `YYYYMMDD`, o formato DATE do RFC. */
function dataParaIcs(iso: string): string {
  return iso.replace(/-/g, '')
}

function somarUmDia(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function gerarIcs(eventos: EventoPrazo[], agora = new Date()): string {
  const carimbo = agora.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vertice//Motor de Produtividade//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Vértice — meus prazos',
    // Sem isto o Google Calendar reconsulta a cada poucos minutos.
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const e of eventos) {
    linhas.push(
      'BEGIN:VEVENT',
      // O UID tem que ser estável entre gerações: é ele que faz o cliente
      // atualizar o evento existente em vez de criar um duplicado a cada sync.
      `UID:cartao-${e.id}@vertice`,
      `DTSTAMP:${carimbo}`,
      // Evento de dia inteiro. DTEND é exclusivo no RFC, daí o +1 dia — sem
      // isso o prazo aparece no dia anterior em alguns clientes.
      `DTSTART;VALUE=DATE:${dataParaIcs(e.prazo)}`,
      `DTEND;VALUE=DATE:${dataParaIcs(somarUmDia(e.prazo))}`,
      `SUMMARY:${escaparTexto(`${e.codigo} · ${e.titulo}`)}`,
      `DESCRIPTION:${escaparTexto(`Quadro: ${e.quadro}\nEtapa: ${e.coluna}\n${e.url}`)}`,
      `URL:${escaparTexto(e.url)}`,
      'END:VEVENT'
    )
  }

  linhas.push('END:VCALENDAR')

  // CRLF é obrigatório no RFC, não estilo.
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}
