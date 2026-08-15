-- Webhook de formulário (pedido do produto: gerar, no mesmo lugar dos
-- formulários públicos, uma forma de criar cartão via automação externa —
-- caso de uso citado foi n8n). Mesma ação de negócio de submeterFormulario
-- (POST /formularios/[slug]), mas autenticada por token em vez de ser
-- pública/anônima: um formulário com webhook ativo aceita POST JSON em
-- api/webhooks/formularios com `Authorization: Bearer <token>` no lugar do
-- visitante preencher a página.
--
-- Tabela separada de `formularios`, não colunas nela: `formularios` tem
-- `grant select on formularios ... to anon` (20260723020000, pro visitante
-- ler o formulário ativo direto via PostgREST) — um token_hash ali ficaria
-- exposto a qualquer requisição anônima que pedisse a coluna. Mesmo motivo
-- de mcp_tokens ter tabela própria em vez de colunas em `colaboradores`.
create table if not exists public.formularios_webhooks (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null unique references public.formularios(id) on delete cascade,
  quadro_id uuid not null references public.quadros(id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes(id),
  -- SHA-256 do segredo (lib/formulario-webhook-auth.ts). Igual mcp_tokens: o
  -- valor em claro só existe na resposta de criação, nunca mais é lido do
  -- banco.
  token_hash text not null unique,
  -- 8 chars hex em claro só pra UI reconhecer qual token é qual.
  token_prefixo text not null,
  ativo boolean not null default true,
  criado_por uuid references public.colaboradores(id),
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  revogado_em timestamptz
);

create index if not exists idx_formularios_webhooks_quadro on public.formularios_webhooks (quadro_id);
create index if not exists idx_formularios_webhooks_organizacao on public.formularios_webhooks (organizacao_id);

alter table public.formularios_webhooks enable row level security;

-- Restritiva (skill vertice-isolamento regra 1): só membro do quadro
-- gerencia o webhook daquele quadro.
create policy "formularios_webhooks_membro" on public.formularios_webhooks
  as restrictive for all
  to authenticated
  using (is_quadro_membro(quadro_id))
  with check (is_quadro_membro(quadro_id));

-- Sem grant para anon: a chamada do webhook chega com o segredo em claro no
-- header, não com sessão — a resolução roda via service role
-- (resolverWebhookFormulario em lib/formulario-webhook-auth.ts), mesmo
-- padrão de resolverMcpToken.
revoke all on public.formularios_webhooks from anon;
