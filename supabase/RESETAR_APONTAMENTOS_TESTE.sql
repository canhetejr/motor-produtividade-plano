-- =====================================================================
-- RESETAR_APONTAMENTOS_TESTE.sql
--
-- Apaga TODOS os apontamentos atuais (dados de teste considerados
-- irreais pelo usuário) e gera novos, sintéticos porém plausíveis, pros
-- últimos 30 dias — respeitando as regras de negócio atuais do banco:
--   * cada apontamento carrega snapshot (tempo_padrao_snapshot /
--     blocos_totais_snapshot), como exige a migration
--     20260721070000_apontamentos_snapshot_travas.sql
--   * quantidade nunca passa de blocos_totais_snapshot (mesmo CHECK do
--     banco, NOT VALID mas ainda assim validado em novos inserts)
--   * demanda "Outros" (variavel = true) sempre entra com
--     tempo_manual_min preenchido e motivo de
--     lib/motivos-outros.ts (Reunião/Treinamento/Suporte a
--     colega/Retrabalho/Imprevisto — sem "Outro" aqui pra não exigir
--     observação obrigatória)
--   * só gera pra colaboradores com role = 'colaborador' e ativo = true
--     (gestor já é excluído das métricas de produtividade, então não
--     precisa de dado sintético)
--   * fins de semana ficam sem lançamento
--   * total de tempo por dia por colaborador mira entre 60% e 120% da
--     carga horária (pra dar variedade real ao farol verde/amarelo/
--     vermelho do dashboard, em vez de todo mundo sempre em 100%)
--
-- PRÉ-REQUISITO: rodar supabase/APLICAR_PENDENTES.sql antes (este script
-- usa as colunas `motivo`, `tempo_padrao_snapshot` e
-- `blocos_totais_snapshot`, que só existem depois dele). Se rodar sem
-- isso, o Postgres vai falhar com "column does not exist" — é esperado,
-- só aplicar o outro script primeiro.
--
-- ATENÇÃO: `delete from apontamentos` é irreversível e afeta TODAS as
-- linhas, sem filtro por colaborador/período. Rodar só se realmente
-- quiser descartar o histórico atual (confirmado pelo usuário: os dados
-- de hoje são de teste/irreais, sem valor a preservar).
-- =====================================================================

begin;

delete from apontamentos;

do $$
declare
  colab record;
  dia date;
  budget numeric;
  used numeric;
  tentativas int;
  d record;
  unit_time numeric;
  qtd int;
  max_qtd int;
  motivos text[] := array['Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto'];
  motivo_escolhido text;
  tempo_manual int;
  outros_id uuid;
begin
  for colab in
    select id, area_id, carga_horaria_min
    from colaboradores
    where ativo = true and role = 'colaborador'
  loop
    dia := current_date - 29;

    while dia <= current_date loop
      if extract(isodow from dia) < 6 then
        budget := colab.carga_horaria_min * (0.6 + random() * 0.6);
        used := 0;
        tentativas := 0;

        -- lançamentos "normais" (demandas fixas da própria área) até
        -- esgotar o orçamento do dia ou 5 tentativas sem achar demanda útil
        while used < budget and tentativas < 5 loop
          tentativas := tentativas + 1;

          select id, tempo_padrao_min, greatest(blocos_totais, 1) as blocos
          into d
          from demandas
          where area_id = colab.area_id
            and ativo = true
            and variavel = false
            and tempo_padrao_min is not null
          order by random()
          limit 1;

          exit when d.id is null;

          unit_time := d.tempo_padrao_min::numeric / d.blocos;
          exit when unit_time <= 0;

          max_qtd := floor((budget - used) / unit_time);
          exit when max_qtd < 1;

          qtd := 1 + floor(random() * least(max_qtd, d.blocos))::int;
          qtd := least(qtd, d.blocos, max_qtd);
          qtd := greatest(qtd, 1);

          insert into apontamentos (
            colaborador_id, demanda_id, data, quantidade,
            tempo_padrao_snapshot, blocos_totais_snapshot
          ) values (
            colab.id, d.id, dia, qtd,
            d.tempo_padrao_min, d.blocos
          );

          used := used + unit_time * qtd;
        end loop;

        -- ~20% de chance de um lançamento extra em "Outros" no dia
        if random() < 0.2 then
          select id into outros_id
          from demandas
          where area_id = colab.area_id and variavel = true
          limit 1;

          if outros_id is not null then
            motivo_escolhido := motivos[1 + floor(random() * array_length(motivos, 1))::int];
            tempo_manual := 15 + floor(random() * 75)::int;

            insert into apontamentos (
              colaborador_id, demanda_id, data, quantidade,
              tempo_manual_min, motivo,
              blocos_totais_snapshot
            ) values (
              colab.id, outros_id, dia, 1,
              tempo_manual, motivo_escolhido,
              1
            );
          end if;
        end if;
      end if;

      dia := dia + 1;
    end loop;
  end loop;
end $$;

commit;

-- =====================================================================
-- Verificação pós-script (rodar no próprio SQL Editor):
--   select count(*) from apontamentos;                     -- > 0
--   select * from indicadores_diarios order by data desc limit 20;
--   select colaborador_id, data, sum(tempo_total_min) as total_dia
--     from apontamentos_calculado group by 1, 2 order by 2 desc limit 20;
-- =====================================================================
