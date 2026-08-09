-- Remove o DEFAULT temporário posto por 20260809130000, que apontava toda
-- coluna organizacao_id para a organização nº 1 (Teralabs). Ele existiu para
-- manter o app ANTIGO (sem noção de organizacao_id) funcionando enquanto a
-- Fase 3 (RLS) ia ao ar antes da Fase 4 (código) — e a própria migration já
-- dizia que precisava sair depois.
--
-- Por que sai agora, e por que só agora: auditando os INSERTs antes de
-- remover, achei 12 sites que ainda não passavam organizacao_id. O DEFAULT
-- não era rede sobressalente — era carga: com ele, um usuário de qualquer
-- organização que não a nº 1 recebia 23503 da FK composta (o organizacao_id
-- do DEFAULT não combinava com o pai). Em desafios_mfa isso significava não
-- conseguir entrar no sistema. Os 12 sites foram corrigidos e foram ao ar
-- ANTES desta migration (commit 091f83d).
--
-- Depois de remover, o codegen do Supabase passa a marcar organizacao_id
-- como obrigatório no tipo Insert, e o tsc virou a prova de que nenhum
-- caminho depende mais do default. Esse passo achou mais 6 sites que a
-- auditoria por regex não pegava, todos usando .upsert() em vez de
-- .insert(): quadros_membros, cartoes_requisitos_status,
-- google_workspace_conexoes, cartoes_responsaveis/seguidores (automação),
-- google_calendar_eventos e push_inscricoes.
--
-- Deixá-lo agora seria pior do que inútil: mascara a próxima omissão, que
-- deixaria de falhar alto e passaria a gravar linha na organização errada
-- sempre que o pai também fosse da nº 1.
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
