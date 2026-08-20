import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { NextRequest } from 'next/server'
import { POST as postMcp } from '@/app/api/mcp/route'
import { criarServidorMcp } from '@/lib/mcp/server'
import { gerarTokenMcp, resolverMcpToken } from '@/lib/mcp-auth'
import { hoje } from '@/lib/dates'

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
// Segundo token da MESMA pessoa, só leitura. Existe para provar que o escopo,
// e não a identidade, é o que autoriza escrever: os dois resolvem para o
// mesmo colaborador e só um consegue gravar.
const tokenMcpSoLeitura = gerarTokenMcp()
const tokenSoLeitura = tokenMcpSoLeitura.token
const demandaAId = randomUUID()
const demandaBId = randomUUID()
const demandaA = `${runId}-demanda-a`
const demandaB = `${runId}-demanda-b`
const apontamentoAId = randomUUID()
const apontamentoBId = randomUUID()
const quadroA = randomUUID()
const quadroB = randomUUID()
const colunaA = randomUUID()
// Segunda coluna do quadro A: destino legítimo de cartao_mover, para separar
// "recusou porque é de outra organização" de "recusou porque não sabe mover".
const colunaA2 = randomUUID()
const colunaB = randomUUID()
const cartaoAId = randomUUID()
const cartaoBId = randomUUID()
const cartaoA = `${runId}-cartao-a`
const cartaoB = `${runId}-cartao-b`
// Data civil de São Paulo, não UTC. O servidor MCP lê "hoje" pelo fuso de
// Maringá (lib/dates::hoje), então uma fixture datada em UTC some das leituras
// sempre que o job roda entre 00:00 e 03:00 UTC — que é 21:00–00:00 em São
// Paulo do dia anterior. A suíte passava de dia e falhava de madrugada.
const hojeIso = hoje()

let admin: SupabaseClient

async function limparFixturesPorOrganizacao(ids: string[]) {
  if (!ids.length) return
  const { data: colaboradores, error: colaboradoresErro } = await admin
    .from('colaboradores')
    .select('id')
    .in('organizacao_id', ids)
  if (colaboradoresErro) throw new Error(`Não listou colaboradores de fixture para cleanup: ${colaboradoresErro.message}`)

  const delecoes = [
    // mcp_escritas antes de mcp_tokens só por clareza — a FK composta
    // (token_id, organizacao_id) já é ON DELETE CASCADE.
    ['mcp_escritas', admin.from('mcp_escritas').delete().in('organizacao_id', ids)],
    ['mcp_tokens', admin.from('mcp_tokens').delete().in('organizacao_id', ids)],
    ['notificacoes', admin.from('notificacoes').delete().in('organizacao_id', ids)],
    ['auditoria', admin.from('auditoria').delete().in('organizacao_id', ids)],
    ['comentarios_cartao', admin.from('comentarios_cartao').delete().in('organizacao_id', ids)],
    ['cartoes_responsaveis', admin.from('cartoes_responsaveis').delete().in('organizacao_id', ids)],
    // Antes de quadros: quadros_membros_quadro_org é FK composta sem cascade,
    // e sem esta linha o cleanup falha em quadros e deixa a organização de
    // fixture inteira para trás.
    ['quadros_membros', admin.from('quadros_membros').delete().in('organizacao_id', ids)],
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

function textoDaTool(resultado: unknown) {
  const content = (resultado as { content?: Array<{ type?: unknown; text?: unknown }> }).content
  const bloco = content?.find((item) => item.type === 'text')
  if (typeof bloco?.text !== 'string') throw new Error('Tool MCP não devolveu conteúdo textual JSON')
  return bloco.text
}

function textoDoResource(resultado: unknown) {
  const texto = (resultado as { contents?: Array<{ text?: unknown }> }).contents?.[0]?.text
  if (typeof texto !== 'string') throw new Error('Resource MCP não devolveu conteúdo textual JSON')
  return texto
}

/**
 * Chama uma tool pelo caminho HTTP/JSON-RPC real — o mesmo que um cliente MCP
 * usa — e devolve o texto bruto da resposta. Escrita é testada por aqui, e não
 * pelo cliente em memória, porque é o endpoint que resolve o token, aplica o
 * escopo e monta a sessão: pular essa camada testaria a metade menos
 * arriscada.
 */
async function chamarToolHttp(token: string, nome: string, argumentos: Record<string, unknown>) {
  const request = new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1_000_000),
      method: 'tools/call',
      params: { name: nome, arguments: argumentos },
    }),
  })
  const response = await postMcp(request)
  return { status: response.status, texto: await response.text() }
}

/**
 * Desembrulha o JSON que a tool devolveu: envelope JSON-RPC → content[0].text
 * → objeto.
 *
 * Sem isto a tentação é `expect(texto).toContain('"repetido": false')`, que
 * falha por um motivo que não tem nada a ver com o comportamento testado: o
 * JSON da tool vai DENTRO de uma string JSON, então no corpo da resposta ele
 * aparece escapado (`\"repetido\": false`) e o substring nunca casa.
 */
function resultadoDaTool(texto: string): Record<string, unknown> {
  const envelope = JSON.parse(texto) as {
    result?: { content?: { type: string; text?: string }[]; isError?: boolean }
  }
  const conteudo = envelope.result?.content?.find((item) => item.type === 'text')?.text
  if (!conteudo) throw new Error(`Resposta MCP sem conteúdo textual: ${texto.slice(0, 200)}`)
  if (envelope.result?.isError) throw new Error(`Tool devolveu erro: ${conteudo}`)
  return JSON.parse(conteudo) as Record<string, unknown>
}

// Cada chamada HTTP faz vários round-trips ao Supabase (limite por IP,
// resolução do token, limite por token, e a própria escrita), e um teste que
// faz duas dessas passa fácil dos 5s padrão do vitest num runner de CI. O
// timeout maior é sobre latência de rede, não sobre esperar um teste lento
// esconder um problema.
const TEMPO_ESCRITA_MS = 30_000

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

    // tempo_padrao_min preenchido porque as demandas não são variáveis:
    // registrar_apontamento_para recusa com DEMANDA_SEM_TEMPO_PADRAO sem ele,
    // e o teste de escrita nunca chegaria ao ponto que interessa.
    const { error: demandasErro } = await admin.from('demandas').insert([
      { id: demandaAId, nome: demandaA, area_id: areaA, organizacao_id: orgA, ativo: true, tempo_padrao_min: 60 },
      { id: demandaBId, nome: demandaB, area_id: areaB, organizacao_id: orgB, ativo: true, tempo_padrao_min: 60 },
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
      { id: colunaA2, quadro_id: quadroA, nome: `${runId}-coluna-a2`, posicao: 2, etapa_final: false, organizacao_id: orgA },
      { id: colunaB, quadro_id: quadroB, nome: `${runId}-coluna-b`, posicao: 1, etapa_final: false, organizacao_id: orgB },
    ])
    if (colunasErro) throw new Error(`Não criou colunas fixture: ${colunasErro.message}`)

    // Os colaboradores da fixture têm role 'colaborador': sem linha em
    // quadros_membros, pode_acessar_quadro() responde false e toda escrita de
    // kanban seria recusada por falta de acesso — o que esconderia o que os
    // testes de isolamento querem medir.
    const { error: membrosErro } = await admin.from('quadros_membros').insert([
      { quadro_id: quadroA, colaborador_id: colaboradorA, organizacao_id: orgA },
      { quadro_id: quadroB, colaborador_id: colaboradorB, organizacao_id: orgB },
    ])
    if (membrosErro) throw new Error(`Não criou membros de quadro fixture: ${membrosErro.message}`)

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

    const { error: tokenErro } = await admin.from('mcp_tokens').insert([
      {
        organizacao_id: orgA, colaborador_id: colaboradorA, nome: runId,
        token_hash: tokenMcpA.tokenHash, token_prefixo: tokenMcpA.tokenPrefixo,
        escopos: ['apontamento:leitura', 'apontamento:escrita', 'kanban:leitura', 'kanban:escrita'],
      },
      {
        organizacao_id: orgA, colaborador_id: colaboradorA, nome: `${runId}-leitura`,
        token_hash: tokenMcpSoLeitura.tokenHash, token_prefixo: tokenMcpSoLeitura.tokenPrefixo,
        escopos: ['apontamento:leitura', 'kanban:leitura'],
      },
    ])
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
  }, TEMPO_ESCRITA_MS)

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

  // ============================================================
  // Escrita (docs/PLANO-MCP-PRODUTO.md, Gate 7)
  // ============================================================
  // A pergunta destes casos não é "a escrita funciona" — é "a escrita
  // funciona SÓ dentro da organização do token". Cada um passa um id da
  // organização B para uma tool autenticada como A e exige recusa MAIS
  // ausência de efeito no banco: uma tool que devolvesse erro e ainda assim
  // tivesse gravado passaria num teste que só olhasse a resposta.

  it('apontamento_registrar grava na organização A e recusa demanda da B', async () => {
    const recusado = await chamarToolHttp(tokenA, 'apontamento_registrar', {
      demanda_id: demandaBId,
      quantidade: 1,
      chave_idempotencia: `${runId}-cross-org`,
    })
    expect(recusado.status).toBe(200)
    // DEMANDA_INATIVA: registrar_apontamento_para procura a demanda filtrando
    // pela organização do colaborador e simplesmente não a encontra.
    expect(recusado.texto).toContain('Demanda não encontrada ou inativa')

    const { count: criadosParaB } = await admin
      .from('apontamentos')
      .select('id', { count: 'exact', head: true })
      .eq('demanda_id', demandaBId)
      .eq('colaborador_id', colaboradorA)
    expect(criadosParaB, 'nenhum apontamento de A pode apontar para demanda de B').toBe(0)

    const aceito = resultadoDaTool(
      (
        await chamarToolHttp(tokenA, 'apontamento_registrar', {
          demanda_id: demandaAId,
          quantidade: 1,
          chave_idempotencia: `${runId}-ok`,
        })
      ).texto
    )
    const apontamento = aceito.apontamento as { id: string; demandaId: string }
    expect(apontamento.demandaId).toBe(demandaAId)

    // Afirma sobre a linha QUE ACABOU DE SER CRIADA, pelo id devolvido. Contar
    // linhas de (colaborador, demanda) daria 2, porque a fixture já cria um
    // apontamento nessa mesma dupla — e o teste falharia por aritmética de
    // fixture, não por comportamento.
    const { data: gravado } = await admin
      .from('apontamentos')
      .select('id, organizacao_id, colaborador_id')
      .eq('id', apontamento.id)
      .single()
    expect(gravado?.organizacao_id).toBe(orgA)
    expect(gravado?.colaborador_id).toBe(colaboradorA)
  }, TEMPO_ESCRITA_MS)

  it('a mesma chave de idempotência não cria um segundo apontamento', async () => {
    const chave = `${runId}-idem`
    const primeira = await chamarToolHttp(tokenA, 'apontamento_registrar', {
      demanda_id: demandaAId, quantidade: 1, chave_idempotencia: chave,
    })
    const segunda = await chamarToolHttp(tokenA, 'apontamento_registrar', {
      demanda_id: demandaAId, quantidade: 1, chave_idempotencia: chave,
    })

    expect(resultadoDaTool(primeira.texto).repetido).toBe(false)
    expect(resultadoDaTool(segunda.texto).repetido).toBe(true)
    // A repetição devolve o registro da primeira, não um apontamento novo.
    expect((resultadoDaTool(segunda.texto).apontamento as { id: string }).id).toBe(
      (resultadoDaTool(primeira.texto).apontamento as { id: string }).id
    )

    const { count } = await admin
      .from('mcp_escritas')
      .select('id', { count: 'exact', head: true })
      .eq('organizacao_id', orgA)
      .eq('chave_idempotencia', chave)
    expect(count, 'a chave repetida deveria ter exatamente uma linha de trilha').toBe(1)
  }, TEMPO_ESCRITA_MS)

  it('token sem escopo de escrita não escreve, mesmo sendo do mesmo colaborador', async () => {
    const { texto } = await chamarToolHttp(tokenSoLeitura, 'apontamento_registrar', {
      demanda_id: demandaAId,
      quantidade: 1,
      chave_idempotencia: `${runId}-sem-escopo`,
    })
    expect(texto).toContain('apontamento:escrita')

    const { count } = await admin
      .from('mcp_escritas')
      .select('id', { count: 'exact', head: true })
      .eq('chave_idempotencia', `${runId}-sem-escopo`)
    expect(count, 'escopo negado não pode nem abrir linha de trilha').toBe(0)
  }, TEMPO_ESCRITA_MS)

  it('cartao_criar recusa coluna da organização B e cria na coluna da A', async () => {
    const recusado = await chamarToolHttp(tokenA, 'cartao_criar', {
      coluna_id: colunaB,
      titulo: `${runId}-nao-deveria-existir`,
      chave_idempotencia: `${runId}-cartao-cross`,
    })
    expect(recusado.texto).toContain('Coluna não encontrada')

    const { count: vazados } = await admin
      .from('cartoes')
      .select('id', { count: 'exact', head: true })
      .eq('organizacao_id', orgB)
      .eq('titulo', `${runId}-nao-deveria-existir`)
    expect(vazados, 'nenhum cartão de A pode ter nascido na organização B').toBe(0)

    const criado = await chamarToolHttp(tokenA, 'cartao_criar', {
      coluna_id: colunaA,
      titulo: `${runId}-cartao-mcp`,
      chave_idempotencia: `${runId}-cartao-ok`,
    })
    expect(criado.texto).toContain(`${runId}-cartao-mcp`)

    const { data: cartaoCriado } = await admin
      .from('cartoes')
      .select('id, organizacao_id, coluna_id')
      .eq('titulo', `${runId}-cartao-mcp`)
      .maybeSingle()
    expect(cartaoCriado?.organizacao_id).toBe(orgA)
    expect(cartaoCriado?.coluna_id).toBe(colunaA)
  }, TEMPO_ESCRITA_MS)

  it('cartao_mover recusa destino na organização B e move dentro da A', async () => {
    const recusado = await chamarToolHttp(tokenA, 'cartao_mover', {
      cartao_id: cartaoAId,
      coluna_destino_id: colunaB,
      chave_idempotencia: `${runId}-mover-cross`,
    })
    expect(recusado.texto).toContain('Coluna não encontrada')

    const { data: intacto } = await admin.from('cartoes').select('coluna_id').eq('id', cartaoAId).single()
    expect(intacto?.coluna_id, 'o cartão de A não pode ter ido para a coluna de B').toBe(colunaA)

    const movido = await chamarToolHttp(tokenA, 'cartao_mover', {
      cartao_id: cartaoAId,
      coluna_destino_id: colunaA2,
      chave_idempotencia: `${runId}-mover-ok`,
    })
    expect(movido.texto).toContain(`${runId}-coluna-a2`)

    const { data: depois } = await admin.from('cartoes').select('coluna_id').eq('id', cartaoAId).single()
    expect(depois?.coluna_id).toBe(colunaA2)
  }, TEMPO_ESCRITA_MS)

  it('cartao_comentar recusa cartão da organização B', async () => {
    const { texto } = await chamarToolHttp(tokenA, 'cartao_comentar', {
      cartao_id: cartaoBId,
      conteudo: `${runId}-comentario-vazado`,
      chave_idempotencia: `${runId}-comentar-cross`,
    })
    expect(texto).toContain('Cartão não encontrado')

    const { count } = await admin
      .from('comentarios_cartao')
      .select('id', { count: 'exact', head: true })
      .eq('cartao_id', cartaoBId)
    expect(count, 'nenhum comentário de A pode aparecer num cartão de B').toBe(0)
  }, TEMPO_ESCRITA_MS)

  it('toda escrita deixa trilha em mcp_escritas dentro da organização do token', async () => {
    const { data: trilha } = await admin
      .from('mcp_escritas')
      .select('organizacao_id, colaborador_id, ferramenta')
      .eq('organizacao_id', orgA)
    expect((trilha ?? []).length).toBeGreaterThan(0)
    for (const linha of trilha ?? []) {
      expect(linha.organizacao_id).toBe(orgA)
      expect(linha.colaborador_id).toBe(colaboradorA)
    }

    const { count: trilhaDeB } = await admin
      .from('mcp_escritas')
      .select('id', { count: 'exact', head: true })
      .eq('organizacao_id', orgB)
    expect(trilhaDeB).toBe(0)
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
