import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { listarDemandasMinhas } from '@/lib/mcp/queries'
import { resolverMcpToken } from '@/lib/mcp-auth'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const rodavel = Boolean(url && key)
const descrever = rodavel ? describe : describe.skip

const sufixo = randomUUID().slice(0, 8)
const orgA = randomUUID()
const orgB = randomUUID()
const areaA = randomUUID()
const areaB = randomUUID()
const colaboradorA = randomUUID()
const colaboradorB = randomUUID()
const tokenA = `vrt_mcp_integration_${randomUUID().replace(/-/g, '')}`
const demandaA = `MCP integração A ${sufixo}`
const demandaB = `MCP integração B ${sufixo}`

let admin: SupabaseClient

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

descrever('MCP: isolamento real entre organizações', () => {
  beforeAll(async () => {
    admin = createClient(url!, key!, { auth: { persistSession: false } })
    const { data: plano, error: planoErro } = await admin
      .from('planos')
      .select('id')
      .eq('codigo', 'trial')
      .single()
    if (planoErro || !plano) throw new Error(`Plano trial indisponível no ambiente de integração: ${planoErro?.message ?? 'sem linha'}`)

    for (const [id, nome] of [[orgA, `MCP Test A ${sufixo}`], [orgB, `MCP Test B ${sufixo}`]] as const) {
      const { error } = await admin.from('organizacoes').insert({
        id,
        nome,
        slug: `mcp-test-${id.slice(0, 8)}`,
        plano_id: plano.id,
        limite_assentos: 5,
        status: 'ativa',
      })
      if (error) throw new Error(`Não criou organização fixture: ${error.message}`)
    }

    const { error: areasErro } = await admin.from('areas').insert([
      { id: areaA, nome: `Área MCP A ${sufixo}`, organizacao_id: orgA },
      { id: areaB, nome: `Área MCP B ${sufixo}`, organizacao_id: orgB },
    ])
    if (areasErro) throw new Error(`Não criou áreas fixture: ${areasErro.message}`)

    const { error: authAErro } = await admin.auth.admin.createUser({
      id: colaboradorA,
      email: `mcp-a-${sufixo}@integration.invalid`,
      password: randomUUID(),
      email_confirm: true,
    })
    if (authAErro) throw new Error(`Não criou usuário Auth A fixture: ${authAErro.message}`)
    const { error: authBErro } = await admin.auth.admin.createUser({
      id: colaboradorB,
      email: `mcp-b-${sufixo}@integration.invalid`,
      password: randomUUID(),
      email_confirm: true,
    })
    if (authBErro) throw new Error(`Não criou usuário Auth B fixture: ${authBErro.message}`)

    const { error: colaboradoresErro } = await admin.from('colaboradores').insert([
      { id: colaboradorA, nome: `Colaborador MCP A ${sufixo}`, area_id: areaA, role: 'colaborador', ativo: true, organizacao_id: orgA },
      { id: colaboradorB, nome: `Colaborador MCP B ${sufixo}`, area_id: areaB, role: 'colaborador', ativo: true, organizacao_id: orgB },
    ])
    if (colaboradoresErro) throw new Error(`Não criou colaboradores fixture: ${colaboradoresErro.message}`)

    const { error: demandasErro } = await admin.from('demandas').insert([
      { nome: demandaA, area_id: areaA, organizacao_id: orgA, ativo: true },
      { nome: demandaB, area_id: areaB, organizacao_id: orgB, ativo: true },
    ])
    if (demandasErro) throw new Error(`Não criou demandas fixture: ${demandasErro.message}`)

    const { error: tokenErro } = await admin.from('mcp_tokens').insert({
      organizacao_id: orgA,
      colaborador_id: colaboradorA,
      nome: `fixture-${sufixo}`,
      token_hash: hashToken(tokenA),
      token_prefixo: tokenA.slice(0, 16),
      escopos: ['apontamento:leitura', 'kanban:leitura'],
    })
    if (tokenErro) throw new Error(`Não criou token MCP fixture: ${tokenErro.message}`)
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('organizacoes').delete().in('id', [orgA, orgB])
    await admin.auth.admin.deleteUser(colaboradorA)
    await admin.auth.admin.deleteUser(colaboradorB)
  })

  it('token da organização A resolve somente a identidade A', async () => {
    const sessao = await resolverMcpToken(`Bearer ${tokenA}`)
    expect(sessao).toMatchObject({ colaboradorId: colaboradorA, organizacaoId: orgA })
  })

  it('leitura MCP da área A não devolve a demanda exclusiva da organização B', async () => {
    const demandas = await listarDemandasMinhas({ colaboradorId: colaboradorA, organizacaoId: orgA }, { areaId: areaA })
    expect(demandas.map((demanda) => demanda.nome)).toContain(demandaA)
    expect(demandas.map((demanda) => demanda.nome)).not.toContain(demandaB)
  })
})
