export function cabecalhosMcp(): Headers {
  return new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
}

export function respostaMcpNaoAutorizado(): Response {
  const headers = cabecalhosMcp()
  headers.set('www-authenticate', 'Bearer')
  return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401, headers })
}

export function respostaMetodoMcpNaoPermitido(): Response {
  const headers = cabecalhosMcp()
  headers.set('allow', 'POST')
  return new Response(null, { status: 405, headers })
}

/**
 * Teto de corpo aceito antes de qualquer parse (Gate 3, item 1).
 *
 * 256 KiB é folgado para JSON-RPC de MCP — a maior chamada prevista é um
 * comentário de cartão, limitado a 5.000 caracteres no schema da tool. O que
 * este teto evita é gastar memória e CPU desserializando um corpo de megabytes
 * só para descobrir depois que ele é inválido.
 */
export const LIMITE_CORPO_BYTES = 256 * 1024

export function respostaMcpCorpoGrande(): Response {
  return new Response(JSON.stringify({ error: 'Corpo da requisição excede o limite.' }), {
    status: 413,
    headers: cabecalhosMcp(),
  })
}

/**
 * 429 com `Retry-After` em segundos, como o Gate 3 exige. O cliente MCP
 * precisa do número para esperar a janela virar em vez de repetir em laço —
 * sem o header, um agente com retry automático vira a própria tempestade.
 */
export function respostaMcpExcedeuLimite(reiniciaEm: Date | null): Response {
  const headers = cabecalhosMcp()
  const segundos = reiniciaEm ? Math.max(1, Math.ceil((reiniciaEm.getTime() - Date.now()) / 1000)) : 60
  headers.set('retry-after', String(segundos))
  return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }), {
    status: 429,
    headers,
  })
}

// Domínios do Vértice. Um cliente MCP (Claude Code, Inspector) não manda
// `Origin` — quem manda é navegador. Então a política é: sem Origin, segue;
// com Origin, tem que ser nosso.
const ORIGENS_PERMITIDAS = new Set([
  'https://vertice.teralabs.cloud',
  'https://dev.vertice.teralabs.cloud',
])

/**
 * Recusa `Origin` de terceiros (Gate 3, item 4). É a defesa contra DNS
 * rebinding que a especificação do MCP recomenda para servidor HTTP: sem ela,
 * uma página qualquer aberta no navegador de quem tem o token poderia fazer o
 * navegador falar com este endpoint. CORS aberto continua fora de questão — o
 * endpoint não responde a preflight nem manda `Access-Control-Allow-Origin`,
 * então o navegador já barra a leitura da resposta; isto barra antes, no envio.
 */
export function origemPermitida(headers: Headers): boolean {
  const origem = headers.get('origin')
  if (!origem) return true
  return ORIGENS_PERMITIDAS.has(origem)
}

export function respostaMcpOrigemRecusada(): Response {
  return new Response(JSON.stringify({ error: 'Origem não permitida.' }), {
    status: 403,
    headers: cabecalhosMcp(),
  })
}
