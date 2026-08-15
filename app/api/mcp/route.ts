import type { NextRequest } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolverMcpToken } from '@/lib/mcp-auth'
import { criarServidorMcp } from '@/lib/mcp/server'
import { respostaMcpNaoAutorizado, respostaMetodoMcpNaoPermitido } from '@/lib/mcp/http'

// Endpoint MCP: fora do matcher de sessão de proxy.ts,
// igual a app/api/cron — a autorização aqui é por Bearer token
// (lib/mcp-auth.ts), nunca por cookie. Cada requisição resolve seu próprio
// token e monta um McpServer/transport novos (modo stateless: sem
// sessionIdGenerator), o que combina com o ciclo de vida de uma function
// serverless — nada precisa sobreviver entre requisições.
export async function POST(request: NextRequest) {
  const sessao = await resolverMcpToken(request.headers.get('authorization'))
  if (!sessao) {
    return respostaMcpNaoAutorizado()
  }

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
  return transport.handleRequest(request)
}

// GET (stream SSE de notificações) e DELETE (encerrar sessão) não se
// aplicam ao modo stateless deste endpoint — só POST é suportado.
export async function GET() {
  return respostaMetodoMcpNaoPermitido()
}

export async function DELETE() {
  return respostaMetodoMcpNaoPermitido()
}
