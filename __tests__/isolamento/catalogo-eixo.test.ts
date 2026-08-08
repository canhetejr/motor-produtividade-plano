// Confere, tabela por tabela, se o eixo de organização já foi aplicado:
// coluna organizacao_id NOT NULL + ao menos uma política restrictive
// mencionando org_atual. Hoje (antes da Fase 1) falha para as 43 — é o
// estado de partida que a Fase 0 pede. Depois de cada fase, mais linhas
// desta tabela passam a passar.
//
// A introspecção vem da RPC public.isolamento_status_tabela (migration
// 20260808160000), porque information_schema e pg_policies não são
// expostas via PostgREST neste projeto e o teste roda como client HTTP
// comum, sem acesso a SQL direto.
//
// Precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente. Sem ela, os testes
// pulam com aviso em vez de derrubar o resto da suíte — este projeto não
// tem, hoje, um banco de teste dedicado, e forçar todo `npm test` a
// depender de rede seria pior que a lacuna que este arquivo tenta fechar.
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { TABELAS_DE_NEGOCIO } from './tabelas'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const rodavel = Boolean(url && key)

const descrever = rodavel ? describe : describe.skip
if (!rodavel) {
  console.warn(
    '[catalogo-eixo] SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausentes — ' +
      'pulando os testes de catálogo do eixo de organização.'
  )
}

type StatusTabela = {
  tem_organizacao_id: boolean
  organizacao_id_not_null: boolean
  tem_politica_restrictive_org_atual: boolean
}

descrever('catálogo do eixo de organização', () => {
  // vitest ainda executa o corpo de um describe.skip (só os `it` internos são
  // pulados) — criar o client aqui incondicionalmente derrubaria a suíte
  // mesmo sem credenciais. O client só é construído se `rodavel` for true.
  const admin = rodavel ? createClient(url!, key!, { auth: { persistSession: false } }) : null

  async function statusDe(tabela: string): Promise<StatusTabela> {
    if (!admin) throw new Error('client não inicializado — não deveria ser chamado sem credenciais')
    const { data, error } = await admin.rpc('isolamento_status_tabela', { p_tabela: tabela })
    if (error) {
      throw new Error(
        `Falha ao chamar isolamento_status_tabela('${tabela}'): ${error.message}. ` +
          'A migration 20260808160000_isolamento_catalogo_status.sql foi aplicada?'
      )
    }
    const linha = Array.isArray(data) ? data[0] : data
    if (!linha) throw new Error(`isolamento_status_tabela('${tabela}') não devolveu linha`)
    return linha as StatusTabela
  }

  it.each(TABELAS_DE_NEGOCIO)('%s tem organizacao_id NOT NULL', async (tabela) => {
    const status = await statusDe(tabela)
    expect(
      status.tem_organizacao_id,
      `${tabela} ainda não tem organizacao_id — esperado antes da Fase 1/2 de docs/PLANO-PRODUTO.md`
    ).toBe(true)
    expect(
      status.organizacao_id_not_null,
      `${tabela}.organizacao_id existe mas ainda aceita NULL — falta o set not null pós-backfill`
    ).toBe(true)
  })

  it.each(TABELAS_DE_NEGOCIO)('%s tem política restrictive citando org_atual', async (tabela) => {
    const status = await statusDe(tabela)
    expect(
      status.tem_politica_restrictive_org_atual,
      `${tabela} não tem política RESTRICTIVE mencionando org_atual — esperado antes da Fase 3. ` +
        'Se existe uma política do eixo mas ela é PERMISSIVE, é o erro descrito na skill ' +
        'vertice-isolamento (regra 1): ela amplia o acesso em vez de restringir.'
    ).toBe(true)
  })
})
