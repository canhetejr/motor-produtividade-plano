import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = resolve(
  process.cwd(),
  'supabase/migrations/20260820160000_apontamentos_data_sao_paulo.sql'
)

const hojeSaoPaulo = "timezone('America/Sao_Paulo', now())::date"

describe('migration de data civil dos apontamentos', () => {
  it('usa São Paulo como fonte única de hoje em gravação, edição e RLS', () => {
    const sql = readFileSync(migration, 'utf8')
    const normalizado = sql.replace(/\s+/g, ' ')

    expect(normalizado).toContain(`alter table public.apontamentos alter column data set default ${hojeSaoPaulo}`)
    expect(normalizado).toContain('create or replace function public.registrar_apontamento_para(')
    expect(normalizado).toContain('create or replace function public.atualizar_apontamento(')
    expect(normalizado).toContain(`data, tempo_padrao_snapshot, blocos_totais_snapshot, organizacao_id ) values ( p_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes, ${hojeSaoPaulo}`)
    expect(normalizado).toContain(`and data = ${hojeSaoPaulo}`)
    expect(sql.match(new RegExp(hojeSaoPaulo.replace(/[()]/g, '\\$&'), 'g'))).toHaveLength(7)
  })
})
