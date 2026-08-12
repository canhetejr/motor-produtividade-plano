import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { NextRequest } from 'next/server'
import { POST as postMcp } from '@/app/api/mcp/route'
import { criarServidorMcp } from '@/lib/mcp/server'
import { gerarTokenMcp, resolverMcpToken } from '@/lib/mcp-auth'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const rodavel = Boolean(url && key)
const descrever = rodavel ? describe : describe.skip

const runId = `mcp-it-${randomUUID().slice(0, 8)}`
const orgA = randomUUID()
const orgB = randomUUID()
const areaA = randomUUID()
const areaB = randomUUID()
const colaboradorA = randomUUID()
const colaboradorB = randomUUID()
// Mesmo gerador criptográfico usado pela Server Action criarMcpToken. A
// autenticação cookie/RLS da UI é outra superfície e não é simulada nesta
// suíte de integração service-role; aqui exercitamos formato, hash, prefixo
// e resolução do token exatamente como o endpoint MCP recebe.
const tokenMcpA = gerarTokenMcp()
const tokenA = tokenMcpA.token
const demandaAId = randomUUID()
const demandaBId = randomUUID()
const demandaA = `${runId}-demanda-a`
const demandaB = `${runId}-demanda-b`
const apontamentoAId = randomUUID()
const apontamentoBId = randomUUID()
const quadroA = randomUUID()
const quadroB = randomUUID()
const colunaA = randomUUID()
const colunaB = randomUUID()
const cartaoAId = randomUUID()
const cartaoBId = randomUUID()
const cartaoA = `${runId}-cartao-a`
const cartaoB = `${runId}-cartao-b`
const hojeIso = new Date().toISOString().slice(0, 10)

let admin: SupabaseClient

async function limparFixturesPorOrganizacao(ids: string[]) {
  if (!ids.length) return
  const { data: colaboradores, error: colaboradoresErro } = await admin
    .from('colaboradores')
    .select('id')
    .in('organizacao_id', ids)
  if (colaboradoresErro) throw new Error(`Não listou colaboradores de fixture para cleanup: ${colaboradoresErro.message}`)

  const delecoes = [
    ['mcp_tokens', admin.from('mcp_tokens').delete().in('organizacao_id', ids)],
    ['notificacoes', admin.from('notificacoes').delete().in('organizacao_id', ids)],
    ['cartoes_responsaveis', admin.from('cartoes_responsaveis').delete().in('organizacao_id', ids)],
    ['cartoes', admin.from('cartoes').delete().in('organizacao_id', ids)],
    ['colunas', admin.from('colunas').delete().in('organizacao_id', ids)],
    ['quadros', admin.from('quadros').delete().in('organizacao_id', ids)],
    ['apontamentos', admin.from('apontamentos').delete().in('organizacao_id', ids)],
    ['demandas', admin.from('demandas').delete().in('organizacao_id', ids)],
    ['colaboradores', admin.from('colaboradores').delete().in('organizacao_id', ids)],
    ['areas', admin.from('areas').delete().in('organizacao_id', ids)],
  ] as const
  for (const [tabela, operacao] of delecoes) {
    const { error } = await operacao
    if (error) throw new Error(`Não removeu fixtures de ${tabela}: ${error.message}`)
  }

  const { error: orgErro } = await admin.from('organizacoes').delete().in('id', ids)
  if (orgErro) throw new Error(`Não removeu organizações de fixture: ${orgErro.message}`)

  for (const colaborador of colaboradores ?? []) {
    const { error } = await admin.auth.admin.deleteUser(colaborador.id)
    if (error) throw new Error(`Não removeu usuário Auth de fixture: ${error.message}`)
  }

  const { count, error: restanteErro } = await admin
    .from('organizacoes')
    .select('id', { count: 'exact', head: true })
    .in('id', ids)
  if (restanteErro || count !== 0) throw new Error('Cleanup deixou organização de fixture no banco de integração')
}

async function limparSobrasDeFixtures() {
  const { data, error } = await admin
    .from('organizacoes')
    .select('id')
    .like('slug', 'mcp-it-%')
  if (error) throw new Error(`Não listou sobras de fixture: ${error.message}`)
  await limparFixturesPorOrganizacao((data ?? []).map((org) => org.id))
}

function textoDaTool(resultado: { content: Array<{ type: string; text?: string }> }) {
  const bloco = resultado.content.find((item) => item.type === 'text')
  if (!bloco?.text) throw new Error('Tool MCP não devolveu conteúdo textual JSON')
  return bloco.text
}

function textoDoResource(resultado: { contents: Array<{ text?: string }> }) {
  const texto = resultado.contents[0]?.text
  if (!texto) throw new Error('Resource MCP não devolveu conteúdo JSON')
  return texto
}

async function comClienteMcpA<T>(executar: (client: Client) => Promise<T>) {
  const sessao = await resolverMcpToken(`Bearer ${tokenA}`)
  if (!sessao) throw new Error('Token MCP fixture A não resolveu uma sessão')

  const server = criarServidorMcp(sessao)
  const client = new Client({ name: 'mcp-isolamento-it', version: '1.0.0' }, { capabilities: {} })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    return await executar(client)
  } finally {
    await client.close()
    await server.close()
  }
}

descrever('MCP: isolamento real entre organizações', () => {
  beforeAll(async () => {
    admin = createClient(url!, key!, { auth: { persistSession: false } })
    await limparSobrasDeFixtures()
    const { data: plano, error: planoErro } = await admin
      .from('planos')
      .select('id')
      .eq('ativo', true)
      .limit(1)
      .single()
    if (planoErro || !plano) throw new Error(`Nenhum plano ativo no ambiente de integração: ${planoErro?.message ?? 'sem linha'}`)

    for (const [id, nome, slug] of [
      [orgA, `${runId}-org-a`, `${runId}-a`],
      [orgB, `${runId}-org-b`, `${runId}-b`],
    ] as const) {
      const { error } = await admin.from('organizacoes').insert({
        id, nome, slug, plano_id: plano.id, limite_assentos: 5, status: 'ativa',
      })
      if (error) throw new Error(`Não criou organização fixture: ${error.message}`)
    }

    const { error: areasErro } = await admin.from('areas').insert([
      { id: areaA, nome: `${runId}-area-a`, organizacao_id: orgA },
      { id: areaB, nome: `${runId}-area-b`, organizacao_id: orgB },
    ])
    if (areasErro) throw new Error(`Não criou áreas fixture: ${areasErro.message}`)

    for (const [id, email] of [
      [colaboradorA, `${runId}-a@integration.invalid`],
      [colaboradorB, `${runId}-b@integration.invalid`],
    ] as const) {
      const { error } = await admin.auth.admin.createUser({ id, email, password: randomUUID(), email_confirm: true })
      if (error) throw new Error(`Não criou usuário Auth fixture: ${error.message}`)
    }

    const { error: colaboradoresErro } = await admin.from('colaboradores').insert([
      { id: colaboradorA, nome: `${runId}-colaborador-a`, area_id: areaA, role: 'colaborador', ativo: true, organizacao_id: orgA },
      { id: colaboradorB, nome: `${runId}-colaborador-b`, area_id: areaB, role: 'colaborador', ativo: true, organizacao_id: orgB },
    ])
    if (colaboradoresErro) throw new Error(`Não criou colaboradores fixture: ${colaboradoresErro.message}`)

    const { error: demandasErro } = await admin.from('demandas').insert([
      { id: demandaAId, nome: demandaA, area_id: areaA, organizacao_id: orgA, ativo: true },
      { id: demandaBId, nome: demandaB, area_id: areaB, organizacao_id: orgB, ativo: true },
    ])
    if (demandasErro) throw new Error(`Não criou demandas fixture: ${demandasErro.message}`)

    const { error: apontamentosErro } = await admin.from('apontamentos').insert([
      { id: apontamentoAId, colaborador_id: colaboradorA, demanda_id: demandaAId, organizacao_id: orgA, data: hojeIso, quantidade: 1 },
      { id: apontamentoBId, colaborador_id: colaboradorB, demanda_id: demandaBId, organizacao_id: orgB, data: hojeIso, quantidade: 1 },
    ])
    if (apontamentosErro) throw new Error(`Não criou apontamentos fixture: ${apontamentosErro.message}`)

    const { error: quadrosErro } = await admin.from('quadros').insert([
      { id: quadroA, nome: `${runId}-quadro-a`, codigo: `A${runId.slice(-5)}`, criado_por: colaboradorA, organizacao_id: orgA },
      { id: quadroB, nome: `${runId}-quadro-b`, codigo: `B${runId.slice(-5)}`, criado_por: colaboradorB, organizacao_id: orgB },
    ])
    if (quadrosErro) throw new Error(`Não criou quadros fixture: ${quadrosErro.message}`)

    const { error: colunasErro } = await admin.from('colunas').insert([
      { id: colunaA, quadro_id: quadroA, nome: `${runId}-coluna-a`, posicao: 1, etapa_final: false, organizacao_id: orgA },
      { id: colunaB, quadro_id: quadroB, nome: `${runId}-coluna-b`, posicao: 1, etapa_final: false, organizacao_id: orgB },
    ])
    if (colunasErro) throw new Error(`Não criou colunas fixture: ${colunasErro.message}`)

    const { error: cartoesErro } = await admin.from('cartoes').insert([
      { id: cartaoAId, coluna_id: colunaA, titulo: cartaoA, posicao: 1, criado_por: colaboradorA, organizacao_id: orgA },
      { id: cartaoBId, coluna_id: colunaB, titulo: cartaoB, posicao: 1, criado_por: colaboradorB, organizacao_id: orgB },
    ])
    if (cartoesErro) throw new Error(`Não criou cartões fixture: ${cartoesErro.message}`)

    const { error: responsaveisErro } = await admin.from('cartoes_responsaveis').insert([
      { cartao_id: cartaoAId, colaborador_id: colaboradorA, organizacao_id: orgA },
      { cartao_id: cartaoBId, colaborador_id: colaboradorB, organizacao_id: orgB },
    ])
    if (responsaveisErro) throw new Error(`Não criou responsáveis fixture: ${responsaveisErro.message}`)

    const { error: tokenErro } = await admin.from('mcp_tokens').insert({
      organizacao_id: orgA, colaborador_id: colaboradorA, nome: runId,
      token_hash: tokenMcpA.tokenHash, token_prefixo: tokenMcpA.tokenPrefixo,
      escopos: ['apontamento:leitura', 'kanban:leitura'],
    })
    if (tokenErro) throw new Error(`Não criou token MCP fixture: ${tokenErro.message}`)
  }, 30_000)

  afterAll(async () => {
    if (!admin) return
    await limparFixturesPorOrganizacao([orgA, orgB])
  }, 30_000)

  it('token A resolve somente a identidade da organização A', async () => {
    const sessao = await resolverMcpToken(`Bearer ${tokenA}`)
    expect(sessao).toMatchObject({ colaboradorId: colaboradorA, organizacaoId: orgA })
  })

  it('tool MCP demandas_minhas inclui A e nunca expõe dado exclusivo de B', async () => {
    const texto = await comClienteMcpA(async (client) => textoDaTool(await client.callTool({ name: 'demandas_minhas', arguments: {} })))
    expect(texto).toContain(demandaA)
    expect(texto).not.toContain(demandaB)
  })

  it('endpoint HTTP/JSON-RPC autenticado não expõe B em nenhuma tool read-only', async () => {
    const chamadas = [
      { name: 'demandas_minhas', arguments: {}, presente: demandaA, ausente: demandaB },
      { name: 'apontamentos_listar', arguments: { desde: hojeIso, ate: hojeIso }, presente: apontamentoAId, ausente: apontamentoBId },
      { name: 'cartoes_meus_pendentes', arguments: {}, presente: cartaoAId, ausente: cartaoBId },
    ]
    for (const [indice, chamada] of chamadas.entries()) {
      const request = new NextRequest('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tokenA}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0', id: indice + 1, method: 'tools/call',
          params: { name: chamada.name, arguments: chamada.arguments },
        }),
      })
      const response = await postMcp(request)
      expect(response.status).toBe(200)
      const texto = await response.text()
      expect(texto).toContain(chamada.presente)
      expect(texto).not.toContain(chamada.ausente)
    }
  })

  it('resource MCP demandas/minhas inclui A e nunca expõe dado exclusivo de B', async () => {
    const texto = await comClienteMcpA(async (client) => textoDoResource(await client.readResource({ uri: 'vertice://demandas/minhas' })))
    expect(texto).toContain(demandaA)
    expect(texto).not.toContain(demandaB)
  })

  it('tool e resource MCP de apontamentos incluem A e nunca expõem dado exclusivo de B', async () => {
    const textoTool = await comClienteMcpA(async (client) => textoDaTool(await client.callTool({
      name: 'apontamentos_listar', arguments: { desde: hojeIso, ate: hojeIso },
    })))
    const textoResource = await comClienteMcpA(async (client) => textoDoResource(await client.readResource({
      uri: 'vertice://apontamentos/hoje',
    })))
    for (const texto of [textoTool, textoResource]) {
      expect(texto).toContain(apontamentoAId)
      expect(texto).toContain(demandaA)
      expect(texto).not.toContain(apontamentoBId)
      expect(texto).not.toContain(demandaB)
    }
  })

  it('tool e resource MCP de cartões incluem A e nunca expõem dado exclusivo de B', async () => {
    const textoTool = await comClienteMcpA(async (client) => textoDaTool(await client.callTool({
      name: 'cartoes_meus_pendentes', arguments: {},
    })))
    const textoResource = await comClienteMcpA(async (client) => textoDoResource(await client.readResource({
      uri: 'vertice://cartoes/meus-pendentes',
    })))
    for (const texto of [textoTool, textoResource]) {
      expect(texto).toContain(cartaoAId)
      expect(texto).toContain(cartaoA)
      expect(texto).not.toContain(cartaoBId)
      expect(texto).not.toContain(cartaoB)
    }
  })
})
