// Isolamento da propriedade da organização (migration 20260812200000).
//
// As duas RPCs desta feature são SECURITY DEFINER, então RLS não protege nada
// aqui por construção (regra 4 da skill vertice-isolamento) — a checagem de
// organização é escrita à mão dentro delas, e é exatamente isso que este
// arquivo exercita. Um teste de leitura nunca pegaria a falha: o vazamento
// seria de ESCRITA, um dono da org A conseguindo apontar a propriedade para
// alguém da org B.
//
// Roda contra banco real. Sem SUPABASE_SERVICE_ROLE_KEY os testes pulam com
// aviso, mesmo critério de catalogo-eixo.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const rodavel = Boolean(url && key)
const descrever = rodavel ? describe : describe.skip

if (!rodavel) {
  console.warn(
    '[dono-organizacao] SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausentes — ' +
      'pulando os testes de propriedade da organização.'
  )
}

const runId = `dono-it-${randomUUID().slice(0, 8)}`
const orgA = randomUUID()
const orgB = randomUUID()
const areaA = randomUUID()
const areaB = randomUUID()

// Org A: dono (gestor+admin), um segundo gestor (destino válido) e um
// colaborador comum (que não pode nada). Org B: só o dono dela, que existe
// para ser um alvo cross-tenant.
const donoA = randomUUID()
const gestorA = randomUUID()
const comumA = randomUUID()
const donoB = randomUUID()

const senha = `${randomUUID()}Aa1!`
const emailDe = (id: string) => `${runId}-${id.slice(0, 8)}@integration.invalid`

let admin: SupabaseClient

async function limparFixtures(ids: string[]) {
  if (!ids.length) return
  const { data: colaboradores, error: listaErro } = await admin
    .from('colaboradores')
    .select('id')
    .in('organizacao_id', ids)
  if (listaErro) throw new Error(`Não listou colaboradores de fixture: ${listaErro.message}`)

  // organizacoes.dono_colaborador_id não tem `on delete` — apagar o
  // colaborador antes de soltar a referência falha na FK composta, que é
  // justamente o comportamento que a migration quis. Zerar a coluna primeiro
  // é o caminho previsto.
  const { error: donoErro } = await admin
    .from('organizacoes')
    .update({ dono_colaborador_id: null })
    .in('id', ids)
  if (donoErro) throw new Error(`Não soltou o dono das organizações de fixture: ${donoErro.message}`)

  for (const [tabela, operacao] of [
    ['colaboradores', admin.from('colaboradores').delete().in('organizacao_id', ids)],
    ['areas', admin.from('areas').delete().in('organizacao_id', ids)],
  ] as const) {
    const { error } = await operacao
    if (error) throw new Error(`Não removeu fixtures de ${tabela}: ${error.message}`)
  }

  const { error: orgErro } = await admin.from('organizacoes').delete().in('id', ids)
  if (orgErro) throw new Error(`Não removeu organizações de fixture: ${orgErro.message}`)

  for (const colaborador of colaboradores ?? []) {
    const { error } = await admin.auth.admin.deleteUser(colaborador.id)
    if (error) throw new Error(`Não removeu usuário Auth de fixture: ${error.message}`)
  }
}

async function limparSobras() {
  const { data, error } = await admin.from('organizacoes').select('id').like('slug', 'dono-it-%')
  if (error) throw new Error(`Não listou sobras de fixture: ${error.message}`)
  await limparFixtures((data ?? []).map((o) => o.id))
}

/**
 * Client autenticado como a pessoa indicada. Precisa ser sessão real: as RPCs
 * comparam `auth.uid()` com o dono, e o client de service role não tem
 * `auth.uid()` nenhum — testá-las por ele provaria o oposto do que interessa.
 */
async function comoUsuario(id: string): Promise<SupabaseClient> {
  const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: emailDe(id), password: senha })
  if (error) throw new Error(`Não autenticou fixture ${id}: ${error.message}`)
  return client
}

descrever('propriedade da organização: isolamento entre empresas', () => {
  beforeAll(async () => {
    admin = createClient(url!, key!, { auth: { persistSession: false } })
    await limparSobras()

    const { data: plano, error: planoErro } = await admin
      .from('planos')
      .select('id')
      .eq('ativo', true)
      .limit(1)
      .single()
    if (planoErro || !plano) throw new Error(`Nenhum plano ativo no ambiente de integração: ${planoErro?.message ?? 'sem linha'}`)

    for (const [id, slug] of [
      [orgA, `${runId}-a`],
      [orgB, `${runId}-b`],
    ] as const) {
      const { error } = await admin.from('organizacoes').insert({
        id,
        nome: `${runId}-${slug}`,
        slug,
        plano_id: plano.id,
        limite_assentos: 10,
        status: 'ativa',
      })
      if (error) throw new Error(`Não criou organização fixture: ${error.message}`)
    }

    const { error: areasErro } = await admin.from('areas').insert([
      { id: areaA, nome: `${runId}-area-a`, organizacao_id: orgA },
      { id: areaB, nome: `${runId}-area-b`, organizacao_id: orgB },
    ])
    if (areasErro) throw new Error(`Não criou áreas fixture: ${areasErro.message}`)

    for (const id of [donoA, gestorA, comumA, donoB]) {
      const { error } = await admin.auth.admin.createUser({
        id,
        email: emailDe(id),
        password: senha,
        email_confirm: true,
      })
      if (error) throw new Error(`Não criou usuário Auth fixture: ${error.message}`)
    }

    const { error: colaboradoresErro } = await admin.from('colaboradores').insert([
      { id: donoA, nome: `${runId}-dono-a`, area_id: areaA, role: 'gestor', admin: true, ativo: true, organizacao_id: orgA },
      { id: gestorA, nome: `${runId}-gestor-a`, area_id: areaA, role: 'gestor', admin: false, ativo: true, organizacao_id: orgA },
      { id: comumA, nome: `${runId}-comum-a`, area_id: areaA, role: 'colaborador', admin: false, ativo: true, organizacao_id: orgA },
      { id: donoB, nome: `${runId}-dono-b`, area_id: areaB, role: 'gestor', admin: true, ativo: true, organizacao_id: orgB },
    ])
    if (colaboradoresErro) throw new Error(`Não criou colaboradores fixture: ${colaboradoresErro.message}`)

    for (const [org, dono] of [
      [orgA, donoA],
      [orgB, donoB],
    ] as const) {
      const { error } = await admin.from('organizacoes').update({ dono_colaborador_id: dono }).eq('id', org)
      if (error) throw new Error(`Não definiu o dono da fixture: ${error.message}`)
    }
  }, 30_000)

  afterAll(async () => {
    if (!admin) return
    await limparFixtures([orgA, orgB])
  }, 30_000)

  // ------------------------------------------------------------------
  // Leitura cruzada — a coluna nova não pode abrir brecha na policy
  // organizacoes_leitura_propria (20260808170000).
  // ------------------------------------------------------------------
  it('o dono da org A não enxerga a linha da org B', async () => {
    const cliente = await comoUsuario(donoA)
    const { data, error } = await cliente.from('organizacoes').select('id, dono_colaborador_id').eq('id', orgB)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('o dono da org A enxerga o próprio dono', async () => {
    const cliente = await comoUsuario(donoA)
    const { data, error } = await cliente
      .from('organizacoes')
      .select('dono_colaborador_id')
      .eq('id', orgA)
      .single()
    expect(error).toBeNull()
    expect(data?.dono_colaborador_id).toBe(donoA)
  })

  // ------------------------------------------------------------------
  // Escrita cruzada — o teste que realmente importa. A RPC é SECURITY
  // DEFINER: se a comparação de organização sumir do corpo dela, este é o
  // único teste que acusa.
  // ------------------------------------------------------------------
  it('o dono da org A não transfere a propriedade para alguém da org B', async () => {
    const cliente = await comoUsuario(donoA)
    const { error } = await cliente.rpc('transferir_propriedade_organizacao', { p_novo_dono_id: donoB })
    expect(error?.message).toContain('COLABORADOR_INVALIDO')

    const { data } = await admin.from('organizacoes').select('dono_colaborador_id').eq('id', orgA).single()
    expect(data?.dono_colaborador_id).toBe(donoA)
  })

  it('a org B continua com o dono dela depois da tentativa cruzada', async () => {
    const { data } = await admin.from('organizacoes').select('dono_colaborador_id').eq('id', orgB).single()
    expect(data?.dono_colaborador_id).toBe(donoB)
  })

  // ------------------------------------------------------------------
  // Privilégio dentro da própria organização.
  // ------------------------------------------------------------------
  it('colaborador comum da org A não edita o nome da empresa', async () => {
    const cliente = await comoUsuario(comumA)
    const { error } = await cliente.rpc('atualizar_nome_organizacao', { p_nome: 'Sequestrada' })
    expect(error?.message).toContain('APENAS_DONO')
  })

  it('gestor não-dono da org A não transfere a propriedade', async () => {
    const cliente = await comoUsuario(gestorA)
    const { error } = await cliente.rpc('transferir_propriedade_organizacao', { p_novo_dono_id: gestorA })
    expect(error?.message).toContain('APENAS_DONO')
  })

  it('a RPC recusa alvo que não é gestor, mesmo sendo da organização certa', async () => {
    const cliente = await comoUsuario(donoA)
    const { error } = await cliente.rpc('transferir_propriedade_organizacao', { p_novo_dono_id: comumA })
    expect(error?.message).toContain('NAO_E_GESTOR')
  })

  it('a RPC recusa transferir para si mesmo', async () => {
    const cliente = await comoUsuario(donoA)
    const { error } = await cliente.rpc('transferir_propriedade_organizacao', { p_novo_dono_id: donoA })
    expect(error?.message).toContain('JA_E_DONO')
  })

  // ------------------------------------------------------------------
  // Invariante dono ⊂ admin.
  // ------------------------------------------------------------------
  it('o dono não pode ser desativado por um admin da própria organização', async () => {
    const cliente = await comoUsuario(donoA)
    const { error } = await cliente.from('colaboradores').update({ ativo: false }).eq('id', donoA)
    expect(error?.message).toContain('DONO_NAO_PODE_SER_DESATIVADO')
  })

  it('o dono não perde admin sem antes transferir a propriedade', async () => {
    const cliente = await comoUsuario(donoA)
    const { error } = await cliente.rpc('definir_admin', { p_colaborador_id: donoA, p_admin: false })
    // Pode falhar por ULTIMO_ADMIN (se for o único) OU pela trava do dono. O
    // que não pode é passar: qualquer um dos dois erros prova que o caminho
    // está fechado.
    expect(error?.message ?? '').toMatch(/DONO_NAO_PODE_PERDER_ADMIN|ULTIMO_ADMIN/)
  })

  // ------------------------------------------------------------------
  // Defesa em profundidade: a FK composta, exercitada por escrita direta e
  // não só pela RPC. Se algum dia organizacoes ganhar policy de UPDATE por
  // engano, é ela que continua segurando.
  // ------------------------------------------------------------------
  it('a FK composta recusa um dono de outra organização mesmo por service role', async () => {
    const { error } = await admin
      .from('organizacoes')
      .update({ dono_colaborador_id: donoB })
      .eq('id', orgA)
    expect(error).not.toBeNull()
    expect(`${error?.message} ${error?.details ?? ''}`).toContain('organizacoes_dono_org')
  })

  // ------------------------------------------------------------------
  // Caminho feliz por último: ele muda o estado da fixture.
  // ------------------------------------------------------------------
  it('o dono transfere para um gestor da própria organização e o promove a admin', async () => {
    const cliente = await comoUsuario(donoA)
    const { error } = await cliente.rpc('transferir_propriedade_organizacao', { p_novo_dono_id: gestorA })
    expect(error).toBeNull()

    const { data: org } = await admin.from('organizacoes').select('dono_colaborador_id').eq('id', orgA).single()
    expect(org?.dono_colaborador_id).toBe(gestorA)

    const { data: novo } = await admin.from('colaboradores').select('admin').eq('id', gestorA).single()
    expect(novo?.admin).toBe(true)

    // O dono anterior continua admin de propósito: evita o cenário "a
    // organização ficou sem nenhum admin" e mantém a troca reversível.
    const { data: antigo } = await admin.from('colaboradores').select('admin').eq('id', donoA).single()
    expect(antigo?.admin).toBe(true)
  })

  it('depois da transferência é o novo dono que edita o nome da empresa', async () => {
    const antigo = await comoUsuario(donoA)
    const { error: erroAntigo } = await antigo.rpc('atualizar_nome_organizacao', { p_nome: `${runId}-nao` })
    expect(erroAntigo?.message).toContain('APENAS_DONO')

    const novo = await comoUsuario(gestorA)
    const { error: erroNovo } = await novo.rpc('atualizar_nome_organizacao', { p_nome: `${runId}-renomeada` })
    expect(erroNovo).toBeNull()

    const { data } = await admin.from('organizacoes').select('nome').eq('id', orgA).single()
    expect(data?.nome).toBe(`${runId}-renomeada`)
  })

  it('nome em branco é recusado pelo banco, não só pela tela', async () => {
    const novo = await comoUsuario(gestorA)
    const { error } = await novo.rpc('atualizar_nome_organizacao', { p_nome: '   ' })
    expect(error?.message).toContain('NOME_INVALIDO')
  })
})
