-- Servidor MCP (docs/PLANO-MCP.md): tokens de API que um colaborador emite
-- para autorizar um agente de IA (Claude Desktop, Claude Code, outro
-- cliente MCP) a agir em seu nome. Diferente de quadros_compartilhamentos
-- (link público, somente leitura, escopado a 1 quadro), este token
-- autoriza o portador a impersonar o colaborador dono via JWT de curta
-- duração (lib/mcp-jwt.ts) — por isso o segredo nunca é persistido em
-- claro, só o hash, e a tabela é acessível somente pelo próprio dono.
create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id),
  colaborador_id uuid not null,
  -- FK composta: garante que o colaborador do token pertence à organização
  -- declarada nele — mesmo padrão de apontamentos/metas/notificacoes em
  -- 20260809100000_fase2_eixo_39_tabelas.sql. MATCH SIMPLE (padrão) não se
  -- aplica aqui porque colaborador_id nunca é nulo, mas mantemos a
  -- convenção do projeto por consistência.
  constraint mcp_tokens_colaborador_org
    foreign key (colaborador_id, organizacao_id)
    references public.colaboradores (id, organizacao_id),
  nome text not null check (length(trim(nome)) > 0),
  -- SHA-256 do segredo gerado em lib/mcp-auth.ts. O valor em claro é
  -- mostrado ao colaborador uma única vez, na criação, e nunca mais —
  -- diferente de quadros_compartilhamentos, aqui o token concede escrita
  -- em nome de uma pessoa, então não pode ser recuperável do banco.
  token_hash text not null unique,
  -- 8 chars hex do token, guardados em claro só para a UI reconhecer qual
  -- token é qual numa lista ("vrt_mcp_a1b2c3d4…") sem expor o segredo.
  token_prefixo text not null,
  -- Escopos por domínio e direção, ex.: apontamento:leitura,
  -- apontamento:escrita, kanban:leitura, kanban:escrita. Tools novas do
  -- MCP crescem essa lista; lib/mcp-auth.ts::requireEscopo() barra antes
  -- de qualquer core rodar.
  escopos text[] not null default '{}',
  expira_em timestamptz,
  revogado_em timestamptz,
  ultimo_uso_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists idx_mcp_tokens_colaborador on public.mcp_tokens (colaborador_id);
-- Serve à política do eixo abaixo — sem ele, filtrar por organizacao_id
-- vira seq scan conforme a tabela cresce (mesma razão de todo índice de
-- eixo no projeto, skill vertice-isolamento regra 3).
create index if not exists idx_mcp_tokens_organizacao on public.mcp_tokens (organizacao_id);

alter table public.mcp_tokens enable row level security;

-- Restritiva, não permissiva (skill vertice-isolamento regra 1): o dono só
-- vê/gerencia os PRÓPRIOS tokens. organizacao_id = org_atual() sozinho não
-- bastaria — dois colaboradores da mesma organização não podem ver o token
-- um do outro, então a condição do dono já cobre o eixo, mas mantemos
-- org_atual() explícito para o caso de organização suspensa (org_atual()
-- vira NULL e a linha some, mesmo que colaborador_id ainda bata).
create policy "mcp_tokens_proprio" on public.mcp_tokens
  as restrictive for all
  to authenticated
  using (colaborador_id = (select auth.uid()) and organizacao_id = (select public.org_atual()))
  with check (colaborador_id = (select auth.uid()) and organizacao_id = (select public.org_atual()));

-- Sem grant para anon: a resolução do token na chamada MCP acontece antes
-- de existir qualquer sessão (é o próprio token que prova quem é o
-- chamador), então só o service role lê nesse momento — ver
-- lib/mcp-auth.ts::resolverMcpToken, allowlisted em
-- __tests__/isolamento/admin-client-estatico.test.ts.
revoke all on public.mcp_tokens from anon;
