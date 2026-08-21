// Teste estático (sem banco, sem rede) do workflow
// .github/workflows/mcp-integracao.yml. Prova em texto — sem depender de
// nenhum parser YAML como dependência nova do projeto — que o job aplica as
// migrations pendentes no banco de integração ANTES da suíte real de
// isolamento, usando exclusivamente MCP_INTEGRATION_DB_URL. Ver causa-raiz:
// __tests__/isolamento chama RPCs (kanban_criar_cartao_para,
// kanban_mover_cartao_para) que só existem depois de
// supabase/migrations/20260820213000_kanban_movimentacao_atomica.sql rodar
// no banco isolado — e o workflow não aplicava nenhuma migration antes.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CAMINHO = join(__dirname, '..', '..', '.github', 'workflows', 'mcp-integracao.yml')

let conteudo: string
let linhas: string[]

beforeAll(() => {
  conteudo = readFileSync(CAMINHO, 'utf-8')
  linhas = conteudo.split('\n')
})

/** Extrai o bloco de texto de um step, do "- name:"/"- uses:"/"- run:" até o próximo step de mesma indentação. */
function blocoDoStep(marcador: string): string {
  const inicio = linhas.findIndex((linha) => linha.includes(marcador))
  if (inicio === -1) {
    throw new Error(`Step não encontrado: ${marcador}`)
  }
  const indentacaoStep = linhas[inicio].match(/^(\s*)-/)?.[1] ?? ''
  let fim = linhas.length
  for (let i = inicio + 1; i < linhas.length; i++) {
    const linha = linhas[i]
    if (linha.trim() === '') continue
    const match = linha.match(/^(\s*)-\s/)
    if (match && match[1] === indentacaoStep) {
      fim = i
      break
    }
  }
  return linhas.slice(inicio, fim).join('\n')
}

describe('workflow mcp-integracao.yml — aplicação de migrations no banco de integração', () => {
  it('exige MCP_INTEGRATION_DB_URL junto dos três secrets existentes na verificação de credenciais', () => {
    const bloco = blocoDoStep('Verificar credenciais')
    expect(bloco).toMatch(/MCP_INTEGRATION_SUPABASE_URL/)
    expect(bloco).toMatch(/MCP_INTEGRATION_SERVICE_ROLE_KEY/)
    expect(bloco).toMatch(/MCP_INTEGRATION_SUPABASE_ANON_KEY/)
    expect(bloco).toMatch(/MCP_INTEGRATION_DB_URL/)
  })

  it('tem uma etapa dedicada que roda supabase db push com --db-url, --yes e --skip-vault', () => {
    expect(conteudo).toMatch(/supabase db push/)
    const inicioPush = linhas.findIndex((linha) => linha.includes('supabase db push'))
    expect(inicioPush).toBeGreaterThan(-1)
    const bloco = blocoDoStep('supabase db push')
    expect(bloco).toMatch(/--db-url\s+"\$MCP_INTEGRATION_DB_URL"/)
    expect(bloco).toMatch(/--yes/)
    expect(bloco).toMatch(/--skip-vault/)
    expect(bloco).not.toMatch(/--include-all/)
  })

  it('a etapa de migration usa SOMENTE MCP_INTEGRATION_DB_URL no seu env, sem os outros secrets', () => {
    const inicioPush = linhas.findIndex((linha) => linha.includes('supabase db push'))
    const indiceStep = (() => {
      for (let i = inicioPush; i >= 0; i--) {
        if (/^\s*-\s*name:/.test(linhas[i])) return i
      }
      throw new Error('Step do supabase db push sem "name:"')
    })()
    const indentacaoStep = linhas[indiceStep].match(/^(\s*)-/)?.[1] ?? ''
    let fimStep = linhas.length
    for (let i = indiceStep + 1; i < linhas.length; i++) {
      const linha = linhas[i]
      if (linha.trim() === '') continue
      const match = linha.match(/^(\s*)-\s/)
      if (match && match[1] === indentacaoStep) {
        fimStep = i
        break
      }
    }
    const blocoStep = linhas.slice(indiceStep, fimStep).join('\n')

    const envInicio = blocoStep.indexOf('env:')
    expect(envInicio).toBeGreaterThan(-1)
    const runInicio = blocoStep.indexOf('run:', envInicio)
    const blocoEnv = blocoStep.slice(envInicio, runInicio === -1 ? undefined : runInicio)

    expect(blocoEnv).toMatch(/MCP_INTEGRATION_DB_URL:\s*\$\{\{\s*secrets\.MCP_INTEGRATION_DB_URL\s*\}\}/)
    expect(blocoEnv).not.toMatch(/MCP_INTEGRATION_SUPABASE_URL/)
    expect(blocoEnv).not.toMatch(/MCP_INTEGRATION_SERVICE_ROLE_KEY/)
    expect(blocoEnv).not.toMatch(/MCP_INTEGRATION_SUPABASE_ANON_KEY/)
  })

  it('aplica a migration antes da suíte real (npm test -- __tests__/isolamento)', () => {
    const indicePush = linhas.findIndex((linha) => linha.includes('supabase db push'))
    const indiceSuite = linhas.findIndex((linha) => linha.includes('npm test -- __tests__/isolamento'))
    expect(indicePush).toBeGreaterThan(-1)
    expect(indiceSuite).toBeGreaterThan(-1)
    expect(indicePush).toBeLessThan(indiceSuite)
  })

  it('a etapa de migration acontece depois da verificação de credenciais', () => {
    const indiceVerificacao = linhas.findIndex((linha) => linha.includes('Verificar credenciais'))
    const indicePush = linhas.findIndex((linha) => linha.includes('supabase db push'))
    expect(indiceVerificacao).toBeGreaterThan(-1)
    expect(indicePush).toBeGreaterThan(indiceVerificacao)
  })

  it('preserva os testes unitários do servidor MCP antes da etapa remota', () => {
    const indiceUnitarios = linhas.findIndex((linha) => linha.includes('npm test -- lib/mcp'))
    const indicePush = linhas.findIndex((linha) => linha.includes('supabase db push'))
    expect(indiceUnitarios).toBeGreaterThan(-1)
    expect(indiceUnitarios).toBeLessThan(indicePush)
  })

  it('dispara para migrations de kanban além das migrations MCP', () => {
    expect(conteudo).toMatch(/supabase\/migrations\/\*\*mcp\*\*/)
    expect(conteudo).toMatch(/supabase\/migrations\/\*\*kanban\*\*/)
  })

  it('não usa --include-all em nenhuma chamada de supabase db push', () => {
    expect(conteudo).not.toMatch(/db push[^\n]*--include-all/)
  })
})
