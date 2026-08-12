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
// O que este arquivo NÃO cobre: leitura/escrita cruzada entre organizações
// com um token real. Isso exigiria duas organizações seedadas com
// colaboradores reais — infraestrutura que, conforme README.md desta
// pasta, ainda não existe para o projeto inteiro (não é lacuna específica
// do MCP). Até existir, a garantia de isolamento do token vem de RLS sobre
// mcp_tokens (não deste teste) e do fato de que o client impersonado
// (utils/supabase/mcp.ts) é uma sessão `authenticated` comum, sujeita à
// mesma RLS que qualquer outra — não um bypass.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
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

describe('lib/mcp-auth: requireEscopo', () => {
  const sessaoBase: McpSessao = {
    tokenId: 'id',
    colaboradorId: 'colab',
    organizacaoId: 'org',
    escopos: ['apontamento:leitura'],
    // Não usado pelos testes desta seção — requireEscopo só olha `escopos`.
    supabase: null as unknown as McpSessao['supabase'],
  }

  it('não lança quando o escopo está presente', () => {
    expect(() => requireEscopo(sessaoBase, 'apontamento:leitura')).not.toThrow()
  })

  it('lança quando o escopo está ausente', () => {
    expect(() => requireEscopo(sessaoBase, 'kanban:escrita')).toThrow('kanban:escrita')
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
