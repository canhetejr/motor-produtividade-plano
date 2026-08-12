-- Reconciliacao de bootstrap limpo: 20260808213000 corrige a unicidade de
-- relatorios_agendados antes da Fase 2 criar organizacao_id. Em produção a
-- coluna já existia ao aplicar aquela migration; em projetos novos a correção
-- precisa ocorrer somente agora, após o eixo multiempresa estar completo.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'relatorios_agendados_nome_unico'
      and conrelid = 'public.relatorios_agendados'::regclass
  ) then
    alter table public.relatorios_agendados drop constraint relatorios_agendados_nome_unico;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'relatorios_agendados_organizacao_id_nome_key'
      and conrelid = 'public.relatorios_agendados'::regclass
  ) then
    alter table public.relatorios_agendados
      add constraint relatorios_agendados_organizacao_id_nome_key unique (organizacao_id, nome);
  end if;
end;
$$;
