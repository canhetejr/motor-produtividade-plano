import { describe, expect, it } from 'vitest'
import { DOCUMENTACAO } from './documentacao'

describe('documentação de acesso MCP', () => {
  it('explica geração de token, configuração no Claude Code, escopos e revogação', () => {
    const mcp = DOCUMENTACAO.find((secao) => secao.id === 'mcp')
    expect(mcp).toBeDefined()

    const texto = mcp!.topicos.map((topico) => `${topico.titulo} ${topico.texto}`).join(' ')
    expect(texto).toContain('Perfil')
    expect(texto).toContain('.mcp.json')
    expect(texto).toContain('apontamento:leitura')
    expect(texto).toContain('kanban:leitura')
    expect(texto).toContain('Revogar')
  })
})
