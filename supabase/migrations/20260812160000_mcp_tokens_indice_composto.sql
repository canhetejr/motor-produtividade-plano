-- Sugerido pelo Supabase Advisor depois que 20260812150000_mcp_tokens.sql foi
-- aplicado: mcp_tokens já tinha índices isolados em colaborador_id e em
-- organizacao_id, mas a FK composta mcp_tokens_colaborador_org
-- (colaborador_id, organizacao_id) → colaboradores(id, organizacao_id) é
-- resolvida por essa dupla junto, não por cada coluna isolada — sem o
-- índice composto, validar a FK em INSERT/DELETE de colaboradores força seq
-- scan em mcp_tokens conforme a tabela cresce.
create index if not exists idx_mcp_tokens_colaborador_organizacao
  on public.mcp_tokens (colaborador_id, organizacao_id);
