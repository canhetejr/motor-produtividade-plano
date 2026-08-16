import { NextRequest } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolverMcpToken } from '@/lib/mcp-auth'
import { criarServidorMcp } from '@/lib/mcp/server'
import {
  LIMITE_CORPO_BYTES,
  origemPermitida,
  respostaMcpCorpoGrande,
  respostaMcpExcedeuLimite,
  respostaMcpNaoAutorizado,
  respostaMcpOrigemRecusada,
  respostaMetodoMcpNaoPermitido,
} from '@/lib/mcp/http'
import { ipDaRequisicao, limitarPorIp, limitarPorToken } from '@/lib/mcp/rate-limit'

// Endpoint MCP (docs/PLANO-MCP.md): fora do matcher de sessão de proxy.ts,
// igual a app/api/cron — a autorização aqui é por Bearer token
// (lib/mcp-auth.ts), nunca por cookie. Cada requisição resolve seu próprio
// token e monta um McpServer/transport novos (modo stateless: sem
// sessionIdGenerator), o que combina com o ciclo de vida de uma function
// serverless — nada precisa sobreviver entre requisições.
//
// A ordem das checagens abaixo é deliberada: o que é barato e não toca o banco
// vem primeiro (origem, tamanho declarado), depois o limite por IP, depois a
// resolução do token, e só então o limite por token. Assim uma varredura
// automatizada é descartada antes de custar uma consulta de token, e o custo
// de cada requisição recusada cresce junto com o quanto ela já provou sobre si.
export async function POST(request: NextRequest) {
  if (!origemPermitida(request.headers)) {
    return respostaMcpOrigemRecusada()
  }

  // Content-Length é uma dica do cliente, não uma garantia: serve para cortar
  // cedo o caso honesto e grande. O corpo lido abaixo é medido de novo.
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (tamanhoDeclarado > LIMITE_CORPO_BYTES) {
    return respostaMcpCorpoGrande()
  }

  const limiteIp = await limitarPorIp(ipDaRequisicao(request.headers))
  if (!limiteIp.permitido) {
    return respostaMcpExcedeuLimite(limiteIp.reiniciaEm)
  }

  const sessao = await resolverMcpToken(request.headers.get('authorization'))
  if (!sessao) {
    return respostaMcpNaoAutorizado()
  }

  const limiteToken = await limitarPorToken(sessao.tokenId)
  if (!limiteToken.permitido) {
    return respostaMcpExcedeuLimite(limiteToken.reiniciaEm)
  }

  // O corpo precisa ser lido aqui para poder ser medido — e, uma vez lido, o
  // stream original está consumido. Daí a requisição remontada abaixo: é a
  // mesma requisição, com o corpo já em memória (limitado a 256 KiB), que o
  // transport passa a enxergar.
  const corpo = await request.text()
  if (Buffer.byteLength(corpo, 'utf8') > LIMITE_CORPO_BYTES) {
    return respostaMcpCorpoGrande()
  }

  const requisicao = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: corpo,
  })

  const server = criarServidorMcp(sessao)
  // enableJsonResponse: cada chamada de tool aqui é uma consulta/gravação
  // rápida sem notificação de progresso — forçar resposta JSON simples em
  // vez de abrir um stream SSE evita depender de uma conexão longa
  // sobrevivendo ao ciclo de vida de uma function serverless da Vercel.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(requisicao)
}

// GET (stream SSE de notificações) e DELETE (encerrar sessão) não se
// aplicam ao modo stateless deste endpoint — só POST é suportado.
export async function GET() {
  return respostaMetodoMcpNaoPermitido()
}

export async function DELETE() {
  return respostaMetodoMcpNaoPermitido()
}
