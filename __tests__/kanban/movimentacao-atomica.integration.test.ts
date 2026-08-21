// Prova de comportamento das RPCs transacionais do Kanban, com Postgres de
// verdade e duas conexões simultâneas.
//
// POR QUE NÃO É NO SUPABASE
// O projeto isolado de integração (khaeknegymhygsdofkce) prova isolamento
// entre organizações através do PostgREST, que é a superfície que o app usa.
// Corrida de transação é outra coisa: precisa de duas sessões controladas,
// uma segurando o commit enquanto a outra tenta passar. Um cluster local
// entrega isso em segundos, sem credencial e sem escrever em banco que
// atende cliente. Produção (bapufbypqmtjtujfbiai) e staging estão fora de
// questão — staging compartilha as credenciais da produção.
//
// COMO RODAR
//   export KANBAN_TESTE_PG_URL="$(scripts/postgres-teste-local.sh iniciar)"
//   npm run test:kanban
//   scripts/postgres-teste-local.sh parar
//
// Sem a variável, os casos PULAM com aviso — mesmo critério dos arquivos de
// __tests__/isolamento: forçar toda a suíte a depender de um serviço externo
// seria pior que a lacuna.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const executar = promisify(execFile)

const urlBase = process.env.KANBAN_TESTE_PG_URL
const rodavel = Boolean(urlBase)
const descrever = rodavel ? describe : describe.skip

if (!rodavel) {
  console.warn(
    '[kanban] KANBAN_TESTE_PG_URL ausente — suíte de movimentação atômica pulada. ' +
      'Suba um Postgres com scripts/postgres-teste-local.sh iniciar.'
  )
}

const BANCO = `kanban_teste_${randomUUID().slice(0, 8)}`
const url = (nome: string) => (urlBase ?? '').replace(/\/[^/]*$/, `/${nome}`)
let dbUrl = ''
let temporarios = ''

const arquivo = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url))
const ESQUEMA = arquivo('../../supabase/testes/esquema-minimo-kanban.sql')
const MIGRATION = arquivo('../../supabase/migrations/20260820213000_kanban_movimentacao_atomica.sql')

async function psql(sql: string, alvo = dbUrl): Promise<string> {
  const { stdout } = await executar('psql', [alvo, '-v', 'ON_ERROR_STOP=1', '-tAq', '-c', sql])
  return stdout.trim()
}

async function arquivoSql(caminho: string, alvo = dbUrl) {
  await executar('psql', [alvo, '-v', 'ON_ERROR_STOP=1', '-q', '-f', caminho])
}

/** Roda um roteiro numa sessão própria. Devolve o erro em vez de lançar. */
async function sessao(passos: string[]): Promise<{ ok: boolean; erro: string }> {
  const caminho = join(temporarios, `${randomUUID()}.sql`)
  // -f faz o psql mandar um comando por vez; com -c o servidor recebe a
  // string inteira de uma vez só, e a corrida deixa de ser observável.
  writeFileSync(caminho, passos.join('\n'))
  try {
    await executar('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-tAq', '-f', caminho])
    return { ok: true, erro: '' }
  } catch (err) {
    return { ok: false, erro: String((err as { stderr?: string }).stderr ?? err) }
  }
}

async function preparar(banco: string) {
  await psql(`drop database if exists ${banco}`, urlBase!)
  await psql(`create database ${banco}`, urlBase!)
  await arquivoSql(ESQUEMA, url(banco))
  await arquivoSql(MIGRATION, url(banco))
}

// --- fixtura: duas organizações completas, quadro com três etapas ---
const orgA = randomUUID()
const orgB = randomUUID()
const gestorA = randomUUID()
const gestorB = randomUUID()
const colaboradorA = randomUUID()
const quadroA = randomUUID()
const quadroB = randomUUID()
const aFazer = randomUUID()
const emAndamento = randomUUID()
const concluido = randomUUID()
const colunaB = randomUUID()

async function semear() {
  await psql(`
    truncate cartoes, comentarios_cartao, cartoes_responsaveis, colunas, quadros_membros,
             quadros, colaboradores, areas, demandas, organizacoes restart identity cascade;

    insert into organizacoes (id, nome) values ('${orgA}', 'Empresa A'), ('${orgB}', 'Empresa B');
    insert into colaboradores (id, organizacao_id, nome, role) values
      ('${gestorA}', '${orgA}', 'Gestor A', 'gestor'),
      ('${colaboradorA}', '${orgA}', 'Colaborador A', 'colaborador'),
      ('${gestorB}', '${orgB}', 'Gestor B', 'gestor');
    insert into quadros (id, organizacao_id, nome) values
      ('${quadroA}', '${orgA}', 'Quadro A'), ('${quadroB}', '${orgB}', 'Quadro B');
    insert into quadros_membros (quadro_id, colaborador_id, organizacao_id) values
      ('${quadroA}', '${colaboradorA}', '${orgA}');
    insert into colunas (id, quadro_id, organizacao_id, nome, posicao, limite_wip, etapa_final) values
      ('${aFazer}', '${quadroA}', '${orgA}', 'A Fazer', 0, null, false),
      ('${emAndamento}', '${quadroA}', '${orgA}', 'Em Andamento', 1, 1, false),
      ('${concluido}', '${quadroA}', '${orgA}', 'Concluído', 2, null, true),
      ('${colunaB}', '${quadroB}', '${orgB}', 'B Fazer', 0, null, false);
  `)
}

async function criarCard(titulo: string, coluna = aFazer, ator = gestorA) {
  const json = await psql(
    `select kanban_criar_cartao_para('${ator}', '${quadroA}', '${coluna}',
       jsonb_build_object('titulo', '${titulo}'))`
  )
  return JSON.parse(json) as { id: string; posicao: number }
}

const posicoes = async (coluna: string) =>
  (await psql(`select titulo || '=' || posicao from cartoes where coluna_id = '${coluna}' order by posicao`))
    .split('\n')
    .filter(Boolean)

beforeAll(async () => {
  if (!rodavel) return
  temporarios = mkdtempSync(join(tmpdir(), 'kanban-teste-'))
  await preparar(BANCO)
  dbUrl = url(BANCO)
}, 60_000)

afterAll(async () => {
  if (!rodavel) return
  // A fixtura vive num banco próprio, criado e destruído por esta suíte.
  await psql(`drop database if exists ${BANCO}`, urlBase!).catch(() => {})
  if (temporarios) rmSync(temporarios, { recursive: true, force: true })
})

beforeEach(async () => {
  if (!rodavel) return
  await semear()
})

descrever('criação de card', () => {
  it('duas criações simultâneas na mesma coluna não empatam na posição', async () => {
    const criar = (titulo: string, segura: boolean) =>
      sessao([
        'begin;',
        `select kanban_criar_cartao_para('${gestorA}', '${quadroA}', '${aFazer}', jsonb_build_object('titulo', '${titulo}'));`,
        segura ? 'select pg_sleep(1.2);' : '',
        'commit;',
      ])

    const primeira = criar('Simultaneo A', true)
    // A segunda entra com a primeira ainda sem commit: ela PRECISA esperar o
    // lock do quadro para ler o max(posicao) já com o card da outra.
    await new Promise((r) => setTimeout(r, 300))
    const [a, b] = await Promise.all([primeira, criar('Simultaneo B', false)])

    expect(a.ok, a.erro).toBe(true)
    expect(b.ok, b.erro).toBe(true)
    expect(await posicoes(aFazer)).toEqual(['Simultaneo A=0', 'Simultaneo B=1'])
  }, 30_000)

  it('recusa criação de quem é de outra organização', async () => {
    const fora = await sessao([
      `select kanban_criar_cartao_para('${gestorB}', '${quadroA}', '${aFazer}', jsonb_build_object('titulo', 'Invasor'));`,
    ])
    expect(fora.ok).toBe(false)
    expect(fora.erro).toContain('COLUNA_INVALIDA')
    expect(await psql('select count(*) from cartoes')).toBe('0')
  })

  it('recusa quem está na organização certa mas fora do quadro', async () => {
    const semQuadro = randomUUID()
    await psql(
      `insert into colaboradores (id, organizacao_id, nome, role) values ('${semQuadro}', '${orgA}', 'De fora', 'colaborador')`
    )
    const fora = await sessao([
      `select kanban_criar_cartao_para('${semQuadro}', '${quadroA}', '${aFazer}', jsonb_build_object('titulo', 'x'));`,
    ])
    expect(fora.ok).toBe(false)
    expect(fora.erro).toContain('NAO_AUTORIZADO')
  })

  it('grava card e responsáveis juntos, ou nenhum dos dois', async () => {
    const card = await criarCard('Com dono')
    expect(await psql(`select count(*) from cartoes_responsaveis where cartao_id = '${card.id}'`)).toBe('0')

    const comResponsavel = JSON.parse(
      await psql(
        `select kanban_criar_cartao_para('${gestorA}', '${quadroA}', '${aFazer}',
           jsonb_build_object('titulo', 'Atribuido'), array['${colaboradorA}']::uuid[])`
      )
    ) as { id: string }
    expect(await psql(`select count(*) from cartoes_responsaveis where cartao_id = '${comResponsavel.id}'`)).toBe('1')

    // Responsável de outra empresa derruba a operação inteira: nada de card
    // órfão sobrando, que era o resultado do insert separado de antes.
    const invalido = await sessao([
      `select kanban_criar_cartao_para('${gestorA}', '${quadroA}', '${aFazer}',
         jsonb_build_object('titulo', 'Nao deve existir'), array['${gestorB}']::uuid[]);`,
    ])
    expect(invalido.ok).toBe(false)
    expect(invalido.erro).toContain('RESPONSAVEL_INVALIDO')
    expect(await psql("select count(*) from cartoes where titulo = 'Nao deve existir'")).toBe('0')
  })
})

descrever('movimento e reordenação', () => {
  it('reordena origem e destino de uma vez, na ordem recebida', async () => {
    const a = await criarCard('A')
    const b = await criarCard('B')
    const c = await criarCard('C')

    await psql(`select kanban_mover_cartao_para('${gestorA}', '${b.id}', '${concluido}',
      '[{"colunaId":"${concluido}","cartaoIds":["${b.id}"]},
        {"colunaId":"${aFazer}","cartaoIds":["${c.id}","${a.id}"]}]'::jsonb)`)

    expect(await posicoes(aFazer)).toEqual(['C=0', 'A=1'])
    expect(await posicoes(concluido)).toEqual(['B=0'])
  })

  it('arrastar para o mesmo lugar é idempotente e não conta como movimento', async () => {
    const a = await criarCard('A')
    const b = await criarCard('B')
    const ordem = `'[{"colunaId":"${aFazer}","cartaoIds":["${b.id}","${a.id}"]}]'::jsonb`

    const primeiro = JSON.parse(
      await psql(`select kanban_mover_cartao_para('${gestorA}', '${b.id}', '${aFazer}', ${ordem})`)
    ) as { movido: boolean }
    const segundo = JSON.parse(
      await psql(`select kanban_mover_cartao_para('${gestorA}', '${b.id}', '${aFazer}', ${ordem})`)
    ) as { movido: boolean }

    expect(primeiro.movido).toBe(false)
    expect(segundo.movido).toBe(false)
    expect(await posicoes(aFazer)).toEqual(['B=0', 'A=1'])
    // Reordenação pura não vira comentário de sistema.
    expect(await psql('select count(*) from comentarios_cartao')).toBe('0')
  })

  it('não deixa alteração parcial quando a ordem recebida é inválida', async () => {
    const a = await criarCard('A')
    const b = await criarCard('B')

    const falha = await sessao([
      // `a` continua em A Fazer: dizer que ele está no destino é o palpite
      // errado que a RPC precisa recusar — depois de já ter movido `b`.
      `select kanban_mover_cartao_para('${gestorA}', '${b.id}', '${concluido}',
        '[{"colunaId":"${concluido}","cartaoIds":["${b.id}","${a.id}"]}]'::jsonb);`,
    ])

    expect(falha.ok).toBe(false)
    expect(falha.erro).toContain('ORDEM_INVALIDA')
    expect(await posicoes(aFazer)).toEqual(['A=0', 'B=1'])
    expect(await posicoes(concluido)).toEqual([])
    expect(await psql('select count(*) from comentarios_cartao')).toBe('0')
  })

  it('tolera card que a tela não conhecia, jogando-o para o fim da coluna', async () => {
    const a = await criarCard('A')
    const b = await criarCard('B')
    // Criado depois que a tela leu: não aparece na lista que o cliente manda.
    await criarCard('C')

    await psql(`select kanban_mover_cartao_para('${gestorA}', '${b.id}', '${aFazer}',
      '[{"colunaId":"${aFazer}","cartaoIds":["${b.id}","${a.id}"]}]'::jsonb)`)

    expect(await posicoes(aFazer)).toEqual(['B=0', 'A=1', 'C=2'])
  })

  it('não move entre quadros nem aceita coluna de outra organização', async () => {
    const a = await criarCard('A')

    const outroQuadro = await sessao([
      `select kanban_mover_cartao_para('${gestorA}', '${a.id}', '${colunaB}');`,
    ])
    expect(outroQuadro.ok).toBe(false)
    // Coluna de outra empresa nem chega a ser "outro quadro": some do filtro
    // de organização antes disso.
    expect(outroQuadro.erro).toContain('COLUNA_INVALIDA')

    const outraOrg = await sessao([`select kanban_mover_cartao_para('${gestorB}', '${a.id}', '${concluido}');`])
    expect(outraOrg.ok).toBe(false)
    expect(outraOrg.erro).toContain('CARTAO_NAO_ENCONTRADO')
    expect(await posicoes(aFazer)).toEqual(['A=0'])
  })

  it('sem p_ordens, põe o card no fim do destino — o caminho do MCP', async () => {
    const a = await criarCard('A')
    await criarCard('B')
    await psql(`select kanban_mover_cartao_para('${gestorA}', '${a.id}', '${concluido}')`)
    const c = await criarCard('C')
    await psql(`select kanban_mover_cartao_para('${gestorA}', '${c.id}', '${concluido}', null, 'MCP')`)

    expect(await posicoes(concluido)).toEqual(['A=0', 'C=1'])
    expect(await psql("select conteudo from comentarios_cartao order by created_at desc limit 1")).toBe(
      'Moveu o card de "A Fazer" para "Concluído" (via MCP).'
    )
  })
})

descrever('limite de WIP sob concorrência', () => {
  it('com uma vaga e dois movimentos simultâneos, só um vence', async () => {
    const a = await criarCard('A')
    const b = await criarCard('B')

    const mover = (id: string, segura: boolean) =>
      sessao([
        'begin;',
        `select kanban_mover_cartao_para('${gestorA}', '${id}', '${emAndamento}');`,
        segura ? 'select pg_sleep(1.2);' : '',
        'commit;',
      ])

    const primeira = mover(a.id, true)
    await new Promise((r) => setTimeout(r, 300))
    const [vencedora, perdedora] = await Promise.all([primeira, mover(b.id, false)])

    expect(vencedora.ok, vencedora.erro).toBe(true)
    expect(perdedora.ok).toBe(false)
    expect(perdedora.erro).toContain('WIP_EXCEDIDO:1')
    expect(await psql(`select count(*) from cartoes where coluna_id = '${emAndamento}'`)).toBe('1')
  }, 30_000)

  // O trigger cobre TODO caminho de escrita, inclusive os que ainda não usam
  // as RPCs (enviar pro topo, mover de quadro, automação). Este caso escreve
  // como eles escrevem: UPDATE direto em cartoes.coluna_id.
  it('trava também o UPDATE direto, sem passar por RPC nenhuma', async () => {
    const a = await criarCard('A')
    const b = await criarCard('B')

    const direto = (id: string, segura: boolean) =>
      sessao([
        'begin;',
        `update cartoes set coluna_id = '${emAndamento}' where id = '${id}';`,
        segura ? 'select pg_sleep(1.2);' : '',
        'commit;',
      ])

    const primeira = direto(a.id, true)
    await new Promise((r) => setTimeout(r, 300))
    const [vencedora, perdedora] = await Promise.all([primeira, direto(b.id, false)])

    expect(vencedora.ok, vencedora.erro).toBe(true)
    expect(perdedora.ok).toBe(false)
    expect(perdedora.erro).toContain('WIP_EXCEDIDO:1')
    expect(await psql(`select count(*) from cartoes where coluna_id = '${emAndamento}'`)).toBe('1')
  }, 30_000)
})

descrever('reordenação de colunas', () => {
  it('reordena o quadro inteiro numa transação', async () => {
    expect(await psql(`select kanban_reordenar_colunas_para('${gestorA}', '${quadroA}',
      array['${concluido}','${aFazer}','${emAndamento}']::uuid[])`)).toBe('3')
    expect(
      await psql(`select nome || '=' || posicao from colunas where quadro_id = '${quadroA}' order by posicao`)
    ).toBe('Concluído=0\nA Fazer=1\nEm Andamento=2')
  })

  it('recusa coluna de outro quadro e não mexe em nada', async () => {
    const falha = await sessao([
      `select kanban_reordenar_colunas_para('${gestorA}', '${quadroA}',
        array['${aFazer}','${emAndamento}','${colunaB}']::uuid[]);`,
    ])
    expect(falha.ok).toBe(false)
    expect(falha.erro).toContain('COLUNA_INVALIDA:quadro')
    expect(await psql(`select posicao from colunas where id = '${colunaB}'`)).toBe('0')
    expect(await psql(`select posicao from colunas where id = '${concluido}'`)).toBe('2')
  })

  it('recusa lista parcial em vez de renumerar pela metade', async () => {
    const falha = await sessao([
      `select kanban_reordenar_colunas_para('${gestorA}', '${quadroA}', array['${aFazer}','${emAndamento}']::uuid[]);`,
    ])
    expect(falha.ok).toBe(false)
    expect(falha.erro).toContain('COLUNAS_DESATUALIZADAS')
  })

  it('recusa quadro de outra organização', async () => {
    const falha = await sessao([
      `select kanban_reordenar_colunas_para('${gestorB}', '${quadroA}', array['${aFazer}']::uuid[]);`,
    ])
    expect(falha.ok).toBe(false)
    expect(falha.erro).toContain('NAO_AUTORIZADO')
  })
})

descrever('entrega em etapa final', () => {
  it('continua entregando ao entrar e reabrindo ao sair', async () => {
    const a = await criarCard('A')

    const entrada = JSON.parse(
      await psql(`select kanban_mover_cartao_para('${gestorA}', '${a.id}', '${concluido}')`)
    ) as { entregue: boolean }
    expect(entrada.entregue).toBe(true)
    expect(await psql(`select entregue_em is not null from cartoes where id = '${a.id}'`)).toBe('t')

    const saida = JSON.parse(
      await psql(`select kanban_mover_cartao_para('${gestorA}', '${a.id}', '${aFazer}')`)
    ) as { entregue: boolean }
    expect(saida.entregue).toBe(false)
    expect(await psql(`select entregue_em is null from cartoes where id = '${a.id}'`)).toBe('t')
  })

  it('registra o comentário de sistema dentro da mesma transação do movimento', async () => {
    const a = await criarCard('A')
    await psql(`select kanban_mover_cartao_para('${gestorA}', '${a.id}', '${concluido}')`)
    expect(await psql('select conteudo from comentarios_cartao')).toBe(
      'Moveu o card de "A Fazer" para "Concluído".'
    )
  })
})

// Um teste de corrida que passa porque a corrida não aconteceu não prova
// nada. Este caso restaura, num banco descartável, a versão ANTERIOR do
// trigger — a que contava o WIP sem travar — e exige que ela FALHE. É o que
// mede se a suíte acima tem dente.
descrever('sensibilidade da suíte', () => {
  it('a mesma corrida estoura o WIP com o trigger antigo, sem lock', async () => {
    const bancoAntigo = `${BANCO}_antigo`
    await preparar(bancoAntigo)
    const anterior = dbUrl
    dbUrl = url(bancoAntigo)
    try {
      await semear()
      const a = await criarCard('A')
      const b = await criarCard('B')

      await psql(`
        create or replace function public.cartoes_validar_saida_etapa()
        returns trigger language plpgsql set search_path = public as $fn$
        declare v_wip integer; v_limite integer;
        begin
          if new.coluna_id is not distinct from old.coluna_id then return new; end if;
          select limite_wip into v_limite from colunas where id = new.coluna_id;
          if v_limite is not null then
            select count(*) into v_wip from cartoes where coluna_id = new.coluna_id and id <> new.id;
            if v_wip >= v_limite then raise exception 'WIP_EXCEDIDO:%', v_limite; end if;
          end if;
          return new;
        end; $fn$;
      `)

      const direto = (id: string, segura: boolean) =>
        sessao([
          'begin;',
          `update cartoes set coluna_id = '${emAndamento}' where id = '${id}';`,
          segura ? 'select pg_sleep(1.2);' : '',
          'commit;',
        ])

      const primeira = direto(a.id, true)
      await new Promise((r) => setTimeout(r, 300))
      const [x, y] = await Promise.all([primeira, direto(b.id, false)])

      expect(x.ok).toBe(true)
      expect(y.ok).toBe(true)
      // Dois cards numa coluna de limite 1: exatamente o bug que a migration
      // fecha, reproduzido aqui de propósito.
      expect(await psql(`select count(*) from cartoes where coluna_id = '${emAndamento}'`)).toBe('2')
    } finally {
      dbUrl = anterior
      await psql(`drop database if exists ${bancoAntigo}`, urlBase!).catch(() => {})
    }
  }, 60_000)
})
