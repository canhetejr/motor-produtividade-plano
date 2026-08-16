-- Reaplica a remoção do DEFAULT temporário de organizacao_id.
--
-- Não é uma decisão nova: `20260809000000_remove_default_temporario_organizacao_id.sql`
-- já removeu esses defaults em produção, e o comentário dele explica por quê
-- (um DEFAULT apontando toda coluna para a organização nº 1 é inofensivo
-- enquanto ela é a única e vira vazamento ativo assim que existir uma
-- segunda). O problema é o NOME daquele arquivo: `20260809000000` é ANTERIOR
-- a `20260809130000`, a migration que criou os defaults. Em produção a ordem
-- real de execução foi a cronológica e o resultado ficou certo; num banco
-- construído do zero pela pasta `supabase/migrations/` — que é o que o
-- Passo 0 do plano manda fazer no ambiente de integração — a ordem é
-- lexicográfica, a remoção roda ANTES da criação, e o banco novo nasce com o
-- default que a produção não tem.
--
-- Foi assim que o ambiente de integração `vertice-mcp-integracao` ficou
-- divergente: 51 colunas com default lá, nenhuma em produção. A divergência
-- aparecia em `lib/database.types.ts` como `organizacao_id?: string` no tipo
-- Insert — ou seja, o tsc deixaria passar exatamente os INSERTs sem
-- organizacao_id que aquela migration foi escrita para proibir.
--
-- A correção não é renomear o arquivo antigo (migration já aplicada não se
-- reescreve): é repetir a remoção com um timestamp que venha depois de tudo.
-- Em produção é no-op — o laço não encontra nenhuma coluna.
--
-- Só metadado: DROP DEFAULT não reescreve tabela.
do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'organizacao_id'
      and column_default = '''00000000-0000-0000-0000-000000000001''::uuid'
  loop
    execute format('alter table public.%I alter column organizacao_id drop default', r.table_name);
  end loop;
end $$;
