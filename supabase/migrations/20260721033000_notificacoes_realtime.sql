-- Sino de notificações trocou polling de 60s por Supabase Realtime — precisa
-- da tabela na publication padrão. Guard idempotente: ADD TABLE não aceita
-- IF NOT EXISTS, então checamos pg_publication_tables antes.

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table notificacoes;
  end if;
end $$;

commit;
