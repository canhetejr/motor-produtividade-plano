import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { criarServidorMcp } from '@/lib/mcp/server'
import { resolverMcpToken } from '@/lib/mcp-auth'

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
const tokenA = `vrt_mcp_${randomUUID().replace(/-/g, '')}`
const demandaA = `${runId}-demanda-a`
const demandaB = `${runId}-demanda-b`

let admin: SupabaseClient

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
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
      { nome: demandaA, area_id: areaA, organizacao_id: orgA, ativo: true },
      { nome: demandaB, area_id: areaB, organizacao_id: orgB, ativo: true },
    ])
    if (demandasErro) throw new Error(`Não criou demandas fixture: ${demandasErro.message}`)

    const { error: tokenErro } = await admin.from('mcp_tokens').insert({
      organizacao_id: orgA, colaborador_id: colaboradorA, nome: runId,
      token_hash: hashToken(tokenA), token_prefixo: tokenA.slice(0, 16),
      escopos: ['apontamento:leitura', 'kanban:leitura'],
    })
    if (tokenErro) throw new Error(`Não criou token MCP fixture: ${tokenErro.message}`)
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('mcp_tokens').delete().eq('token_hash', hashToken(tokenA))
    await admin.from('organizacoes').delete().in('id', [orgA, orgB])
    await admin.auth.admin.deleteUser(colaboradorA)
    await admin.auth.admin.deleteUser(colaboradorB)
  })

  it('token A resolve somente a identidade da organização A', async () => {
    const sessao = await resolverMcpToken(`Bearer ${tokenA}`)
    expect(sessao).toMatchObject({ colaboradorId: colaboradorA, organizacaoId: orgA })
  })

  it('tool MCP demandas_minhas inclui A e nunca expõe dado exclusivo de B', async () => {
    const texto = await comClienteMcpA(async (client) => textoDaTool(await client.callTool({ name: 'demandas_minhas', arguments: {} })))
    expect(texto).toContain(demandaA)
    expect(texto).not.toContain(demandaB)
  })

  it('resource MCP demandas/minhas inclui A e nunca expõe dado exclusivo de B', async () => {
    const texto = await comClienteMcpA(async (client) => textoDoResource(await client.readResource({ uri: 'vertice://demandas/minhas' })))
    expect(texto).toContain(demandaA)
    expect(texto).not.toContain(demandaB)
  })
})
