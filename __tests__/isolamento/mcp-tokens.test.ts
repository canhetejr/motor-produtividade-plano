// Servidor MCP (docs/PLANO-MCP.md). Duas partes:
//
// 1. Testes puros (rodam sempre, sem banco): formato do token gerado,
//    rejeição de header ausente/malformado antes de qualquer round-trip, e
//    checagem de escopo.
// 2. Teste de introspecção via isolamento_status_tabela (mesma RPC que
//    catalogo-eixo.test.ts usa), confirmando que mcp_tokens tem
//    organizacao_id NOT NULL e uma política restrictive citando
//    org_atual — pula com aviso sem SUPABASE_SERVICE_ROLE_KEY, mesmo padrão
//    do resto desta pasta.
//
// O que este arquivo NÃO cobre: leitura cruzada entre organizações com um
// token real. Isso exigiria duas organizações seedadas com colaboradores
// reais — infraestrutura que, conforme README.md desta pasta, ainda não
// existe para o projeto inteiro (não é lacuna específica do MCP). Até
// existir, a garantia de isolamento vem do filtro explícito por
// organizacao_id em toda consulta de lib/mcp/queries.ts (não deste teste) —
// não há RLS em jogo aqui: o MCP roda inteiramente via service role,
// confinado a lib/mcp-auth.ts e lib/mcp/queries.ts (ver comentário no topo
// de resolverMcpToken sobre por que não há impersonação de sessão).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Mock de utils/supabase/admin: os testes de resolverMcpToken abaixo cobrem
// as ramificações de colaborador ativo/organização ativa/token revogado ou
// expirado sem precisar de SUPABASE_SERVICE_ROLE_KEY nem banco real — só
// lib/mcp-auth.ts e lib/mcp/queries.ts têm permissão de usar
// createAdminClient() no fluxo MCP (allowlist em admin-client-estatico.test.ts);
// aqui simulamos exatamente essa fronteira.
vi.mock('@/utils/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/utils/supabase/admin'
import { gerarTokenMcp, resolverMcpToken, requireEscopo, PREFIXO_TOKEN_MCP, type McpSessao } from '../../lib/mcp-auth'

describe('lib/mcp-auth: geração de token', () => {
  it('gera token com o prefixo esperado e hash SHA-256 de 64 chars hex', () => {
    const { token, tokenHash, tokenPrefixo } = gerarTokenMcp()
    expect(token.startsWith(PREFIXO_TOKEN_MCP)).toBe(true)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(token.startsWith(tokenPrefixo)).toBe(true)
  })

  it('gera segredos diferentes a cada chamada', () => {
    const a = gerarTokenMcp()
    const b = gerarTokenMcp()
    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).not.toBe(b.tokenHash)
  })
})

describe('lib/mcp-auth: resolverMcpToken rejeita antes de tocar o banco', () => {
  it('devolve null sem header Authorization', async () => {
    expect(await resolverMcpToken(null)).toBeNull()
  })

  it('devolve null para header que não é Bearer', async () => {
    expect(await resolverMcpToken('Basic abc123')).toBeNull()
  })

  it('devolve null para Bearer sem o prefixo vrt_mcp_', async () => {
    expect(await resolverMcpToken('Bearer token-qualquer')).toBeNull()
  })
})

type RegistroToken = {
  id: string
  colaborador_id: string
  organizacao_id: string
  escopos: string[]
  expira_em: string | null
  revogado_em: string | null
} | null

type RegistroColaborador = { ativo: boolean; organizacoes: { status: string } | null } | null

// Reproduz só a fatia da API do client Supabase que resolverMcpToken usa —
// `.from('mcp_tokens').select(...).eq(...).maybeSingle()` para achar o
// token, `.from('colaboradores').select(...).eq(...).eq(...).maybeSingle()`
// para checar ativo/organização, e `.from('mcp_tokens').update(...).eq(...)`
// (thenable, disparo sem await) para o carimbo de último uso.
function criarAdminMock(params: { registroToken: RegistroToken; registroColaborador?: RegistroColaborador }) {
  const from = vi.fn((tabela: string) => {
    if (tabela === 'mcp_tokens') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: params.registroToken, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            then: (resolve: (r: { error: null }) => void) => {
              resolve({ error: null })
              return Promise.resolve()
            },
          }),
        }),
      }
    }
    if (tabela === 'colaboradores') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: params.registroColaborador ?? null, error: null }),
            }),
          }),
        }),
      }
    }
    throw new Error(`tabela inesperada no mock de createAdminClient: ${tabela}`)
  })
  return { from }
}

const TOKEN_TESTE = gerarTokenMcp().token
const AUTH_HEADER = `Bearer ${TOKEN_TESTE}`

describe('lib/mcp-auth: resolverMcpToken com mock de createAdminClient', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReset()
  })

  it('token válido + colaborador ativo + organização ativa → devolve McpSessao', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      criarAdminMock({
        registroToken: {
          id: 'tok-1',
          colaborador_id: 'colab-1',
          organizacao_id: 'org-1',
          escopos: ['apontamento:leitura'],
          expira_em: null,
          revogado_em: null,
        },
        registroColaborador: { ativo: true, organizacoes: { status: 'ativa' } },
      }) as unknown as ReturnType<typeof createAdminClient>
    )

    const sessao = await resolverMcpToken(AUTH_HEADER)
    expect(sessao).toEqual({
      tokenId: 'tok-1',
      colaboradorId: 'colab-1',
      organizacaoId: 'org-1',
      escopos: ['apontamento:leitura'],
    })
  })

  it('colaborador ativo = false → devolve null', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      criarAdminMock({
        registroToken: {
          id: 'tok-2',
          colaborador_id: 'colab-2',
          organizacao_id: 'org-1',
          escopos: ['apontamento:leitura'],
          expira_em: null,
          revogado_em: null,
        },
        registroColaborador: { ativo: false, organizacoes: { status: 'ativa' } },
      }) as unknown as ReturnType<typeof createAdminClient>
    )

    expect(await resolverMcpToken(AUTH_HEADER)).toBeNull()
  })

  it('organização suspensa → devolve null', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      criarAdminMock({
        registroToken: {
          id: 'tok-3',
          colaborador_id: 'colab-3',
          organizacao_id: 'org-2',
          escopos: ['apontamento:leitura'],
          expira_em: null,
          revogado_em: null,
        },
        registroColaborador: { ativo: true, organizacoes: { status: 'suspensa' } },
      }) as unknown as ReturnType<typeof createAdminClient>
    )

    expect(await resolverMcpToken(AUTH_HEADER)).toBeNull()
  })

  it('organização fora de trialing/ativa (ex.: expirada) → devolve null', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      criarAdminMock({
        registroToken: {
          id: 'tok-4',
          colaborador_id: 'colab-4',
          organizacao_id: 'org-3',
          escopos: ['apontamento:leitura'],
          expira_em: null,
          revogado_em: null,
        },
        registroColaborador: { ativo: true, organizacoes: { status: 'expirada' } },
      }) as unknown as ReturnType<typeof createAdminClient>
    )

    expect(await resolverMcpToken(AUTH_HEADER)).toBeNull()
  })

  it('token revogado → devolve null sem consultar colaboradores', async () => {
    const mock = criarAdminMock({
      registroToken: {
        id: 'tok-5',
        colaborador_id: 'colab-5',
        organizacao_id: 'org-4',
        escopos: ['apontamento:leitura'],
        expira_em: null,
        revogado_em: '2020-01-01T00:00:00.000Z',
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as unknown as ReturnType<typeof createAdminClient>)

    expect(await resolverMcpToken(AUTH_HEADER)).toBeNull()
    // Curto-circuita antes de checar colaborador/organização — só um
    // round-trip (a busca do próprio token), nunca dois.
    expect(mock.from).toHaveBeenCalledTimes(1)
  })

  it('token expirado → devolve null sem consultar colaboradores', async () => {
    const mock = criarAdminMock({
      registroToken: {
        id: 'tok-6',
        colaborador_id: 'colab-6',
        organizacao_id: 'org-5',
        escopos: ['apontamento:leitura'],
        expira_em: '2020-01-01T00:00:00.000Z',
        revogado_em: null,
      },
    })
    vi.mocked(createAdminClient).mockReturnValue(mock as unknown as ReturnType<typeof createAdminClient>)

    expect(await resolverMcpToken(AUTH_HEADER)).toBeNull()
    expect(mock.from).toHaveBeenCalledTimes(1)
  })

  it('token não encontrado no banco → devolve null', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      criarAdminMock({ registroToken: null }) as unknown as ReturnType<typeof createAdminClient>
    )

    expect(await resolverMcpToken(AUTH_HEADER)).toBeNull()
  })
})

describe('lib/mcp-auth: requireEscopo', () => {
  const sessaoBase: McpSessao = {
    tokenId: 'id',
    colaboradorId: 'colab',
    organizacaoId: 'org',
    escopos: ['apontamento:leitura'],
  }

  it('não lança quando o escopo está presente', () => {
    expect(() => requireEscopo(sessaoBase, 'apontamento:leitura')).not.toThrow()
  })

  it('lança quando o escopo está ausente', () => {
    expect(() => requireEscopo(sessaoBase, 'kanban:leitura')).toThrow('kanban:leitura')
  })
})

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const rodavel = Boolean(url && key)

const descrever = rodavel ? describe : describe.skip
if (!rodavel) {
  console.warn(
    '[mcp-tokens] SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausentes — ' +
      'pulando a checagem de RLS de mcp_tokens contra o banco real.'
  )
}

descrever('mcp_tokens: eixo de organização', () => {
  const admin = rodavel ? createClient(url!, key!, { auth: { persistSession: false } }) : null

  it('tem organizacao_id NOT NULL e política restrictive citando org_atual', async () => {
    if (!admin) throw new Error('client não inicializado — não deveria ser chamado sem credenciais')
    const { data, error } = await admin.rpc('isolamento_status_tabela', { p_tabela: 'mcp_tokens' })
    if (error) {
      throw new Error(
        `Falha ao chamar isolamento_status_tabela('mcp_tokens'): ${error.message}. ` +
          'A migration 20260812150000_mcp_tokens.sql foi aplicada?'
      )
    }
    const linha = Array.isArray(data) ? data[0] : data
    if (!linha) throw new Error("isolamento_status_tabela('mcp_tokens') não devolveu linha")
    expect(linha.tem_organizacao_id, 'mcp_tokens.organizacao_id deveria existir').toBe(true)
    expect(linha.organizacao_id_not_null, 'mcp_tokens.organizacao_id deveria ser NOT NULL').toBe(true)
    expect(
      linha.tem_politica_restrictive_org_atual,
      'mcp_tokens deveria ter política restrictive citando org_atual'
    ).toBe(true)
  })
})
