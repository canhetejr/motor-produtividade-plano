// Contrato da migration de movimentação atômica do Kanban.
//
// Estes casos leem o SQL como texto. Não substituem a prova de comportamento
// (__tests__/kanban/movimentacao-atomica.integration.test.ts, que sobe um
// Postgres e provoca as corridas de verdade) — cobrem a classe de erro que a
// prova de comportamento não pega: alguém remover um `for update`, afrouxar
// um grant ou deixar cair a checagem de organização num refactor futuro, em
// ambiente onde a suíte de integração não roda.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  fileURLToPath(new URL('./migrations/20260820213000_kanban_movimentacao_atomica.sql', import.meta.url)),
  'utf8'
)

const FUNCOES_PARAMETRIZADAS = [
  'kanban_mover_cartao_para',
  'kanban_criar_cartao_para',
  'kanban_reordenar_colunas_para',
]

const WRAPPERS = ['kanban_mover_cartao', 'kanban_criar_cartao', 'kanban_reordenar_colunas']

describe('serialização', () => {
  it('toma o lock consultivo do quadro antes de decidir posição', () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('kanban_quadro'), hashtext(p_quadro_id::text))")
    // Uma vez por RPC: mover, criar e reordenar colunas.
    expect(migration.match(/perform public\.kanban_lock_quadro\(/g)).toHaveLength(3)
  })

  it('usa lock de transação, e não de sessão', () => {
    // Lock de sessão vazaria para a próxima requisição que pegasse a mesma
    // conexão no pooler do Supabase.
    expect(migration).not.toContain('pg_advisory_lock(')
    expect(migration).not.toContain('pg_advisory_unlock')
  })

  it('conta o WIP com a linha da coluna de destino travada', () => {
    const trigger = migration.slice(migration.indexOf('function public.cartoes_validar_saida_etapa'))
    const trava = trigger.indexOf('select limite_wip into v_limite from colunas where id = new.coluna_id for update')
    const contagem = trigger.indexOf('select count(*) into v_wip')
    expect(trava).toBeGreaterThan(-1)
    expect(contagem).toBeGreaterThan(trava)
  })

  it('calcula a posição do card novo por max + 1, não por contagem', () => {
    expect(migration).toContain('select coalesce(max(posicao) + 1, 0) into v_posicao')
  })
})

describe('isolamento entre organizações', () => {
  it('deriva a organização da linha do colaborador, nunca de parâmetro', () => {
    expect(migration).toContain('v_org := public.kanban_org_do_colaborador(p_colaborador_id)')
    expect(migration).toContain("o.status in ('trialing', 'ativa')")
    for (const funcao of FUNCOES_PARAMETRIZADAS) {
      expect(migration, funcao).not.toContain(`${funcao}(p_organizacao_id`)
    }
  })

  it('relê todo id de fora com filtro de organização antes de escrever', () => {
    for (const trecho of [
      'from cartoes c\n  where c.id = p_cartao_id and c.organizacao_id = v_org',
      'where col.id = p_coluna_destino_id and col.organizacao_id = v_org',
      'where col.id = p_coluna_id and col.organizacao_id = v_org',
      'where id = p_quadro_id and organizacao_id = v_org',
    ]) {
      expect(migration, trecho).toContain(trecho)
    }
  })

  it('recusa card de outra coluna/quadro/empresa dentro de p_ordens', () => {
    expect(migration).toContain('left join cartoes c on c.id = r.cartao_id and c.organizacao_id = v_org')
    expect(migration).toContain('where c.id is null or c.coluna_id <> r.coluna_id')
    expect(migration).toContain("raise exception 'ORDEM_INVALIDA:conteudo'")
  })

  it('recusa coluna de outro quadro na reordenação de colunas', () => {
    expect(migration).toContain('where c.id = x and c.quadro_id = p_quadro_id and c.organizacao_id = v_org')
    expect(migration).toContain("raise exception 'COLUNA_INVALIDA:quadro'")
  })

  it('reusa pode_acessar_quadro em vez de reimplementar a regra das policies', () => {
    expect(migration.match(/public\.pode_acessar_quadro\(/g)?.length).toBeGreaterThanOrEqual(3)
    expect(migration).toContain("raise exception 'NAO_AUTORIZADO:quadro'")
  })
})

describe('autorização e superfície exposta', () => {
  it('mantém as variantes parametrizadas fora do alcance de authenticated e anon', () => {
    for (const funcao of FUNCOES_PARAMETRIZADAS) {
      const revoke = new RegExp(`revoke all on function public\\.${funcao}\\([^)]*\\) from public, anon, authenticated;`)
      const grant = new RegExp(`grant execute on function public\\.${funcao}\\([^)]*\\) to service_role;`)
      expect(migration, funcao).toMatch(revoke)
      expect(migration, funcao).toMatch(grant)
      expect(migration, funcao).not.toMatch(
        new RegExp(`grant execute on function public\\.${funcao}\\([^)]*\\) to [^;]*authenticated`)
      )
    }
  })

  it('expõe a authenticated só os wrappers, que derivam a pessoa de auth.uid()', () => {
    for (const wrapper of WRAPPERS) {
      expect(migration, wrapper).toMatch(
        new RegExp(`grant execute on function public\\.${wrapper}\\([^)]*\\) to authenticated;`)
      )
      expect(migration, wrapper).toMatch(
        new RegExp(`revoke all on function public\\.${wrapper}\\([^)]*\\) from public, anon;`)
      )
    }
    expect(migration.match(/public\.kanban_\w+_para\(auth\.uid\(\)/g)).toHaveLength(3)
  })

  it('nunca concede execução a anon', () => {
    expect(migration).not.toMatch(/grant execute on function[^;]*\banon\b/)
  })

  it('fixa search_path em toda função nova', () => {
    const definicoes = migration.match(/create or replace function public\.\w+/g) ?? []
    expect(definicoes.length).toBeGreaterThanOrEqual(7)
    expect(migration.match(/set search_path = public/g)?.length).toBe(definicoes.length)
  })
})

describe('atomicidade e posições', () => {
  it('não deixa nenhuma escrita de posição fora das funções', () => {
    // Só a normalização do estado existente escreve posição em nível de
    // arquivo; tudo o mais acontece dentro das RPCs.
    const foraDeFuncao = migration.split('$$').filter((_, i) => i % 2 === 0).join('\n')
    const updates = foraDeFuncao.match(/^update public\.\w+/gm) ?? []
    expect(updates).toEqual(['update public.cartoes', 'update public.colunas'])
  })

  it('renumera as colunas afetadas num único UPDATE em lote', () => {
    expect(migration).toContain('row_number() over (')
    expect(migration).toContain('where c.id = f.id and c.posicao is distinct from f.nova')
  })

  it('normaliza posições duplicadas herdadas do desenho anterior', () => {
    expect(migration).toContain('partition by coluna_id order by posicao, created_at, id')
    expect(migration).toContain('partition by quadro_id order by posicao, created_at, id')
  })

  it('registra a decisão de posição inteira densa no próprio SQL', () => {
    expect(migration).toContain('ESTRATÉGIA DE POSIÇÃO')
    expect(migration.toLowerCase()).toContain('esparsa')
  })

  it('não edita migration já aplicada', () => {
    expect(migration).not.toMatch(/drop (trigger|function) if exists trg_cartoes_aplicar_entrega/)
    // A entrega em etapa final continua sendo do trigger de 20260730100000:
    // a migration recria a validação de saída, não a de entrega.
    expect(migration).not.toContain('function public.cartoes_aplicar_entrega')
  })

  it('preserva as regras de pré-requisito e requisito de etapa ao recriar o trigger', () => {
    expect(migration).toContain("raise exception 'PREREQUISITO_PENDENTE:%'")
    expect(migration).toContain("raise exception 'REQUISITO_OBRIGATORIO_PENDENTE:%'")
    expect(migration).toContain("raise exception 'WIP_EXCEDIDO:%'")
  })
})
