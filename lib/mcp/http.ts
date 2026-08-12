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
