-- W1/F16: notificacao push com o app fechado.
--
-- As chaves VAPID ficam no BANCO, e nao em variavel de ambiente. Motivo
-- pratico: uma variavel a mais e uma variavel a mais para colar errado — foi
-- exatamente uma chave colada da tela mascarada que derrubou o login desta
-- aplicacao. Aqui o par e gerado uma vez pelo servidor e nunca passa pela mao
-- de ninguem.
--
-- Motivo de seguranca: o segredo ja esta no mesmo perimetro. Quem tem a
-- SUPABASE_SERVICE_ROLE_KEY le esta tabela de qualquer forma, entao guardar a
-- chave privada aqui nao amplia a superficie — enquanto uma variavel de
-- ambiente aparece no painel, em log de build e no historico de quem a colou.
create table if not exists public.config_push (
  id boolean primary key default true check (id),
  chave_publica text not null,
  chave_privada text not null,
  assunto text not null default 'mailto:notificacoes@teralabs.cloud',
  criado_em timestamptz not null default now()
);

-- NENHUM grant e NENHUMA policy: so a service role alcanca. A chave publica sai
-- para o cliente por uma action, nao por leitura direta da tabela — assim a
-- privada nunca fica a uma coluna de distancia de um select mal escrito.
alter table public.config_push enable row level security;
revoke all on public.config_push from anon, authenticated;

create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz,
  -- O navegador descarta a inscricao sozinho (reinstalacao, limpeza de dados) e
  -- o endpoint passa a devolver 404/410. Marcar em vez de apagar na hora deixa
  -- rastro de que existiu.
  invalida_em timestamptz
);

create index if not exists idx_push_inscricoes_colaborador_id on public.push_inscricoes (colaborador_id);

alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon;

create policy push_inscricoes_select_own on public.push_inscricoes
  for select using (colaborador_id = (select auth.uid()));
create policy push_inscricoes_insert_own on public.push_inscricoes
  for insert with check (colaborador_id = (select auth.uid()));
create policy push_inscricoes_delete_own on public.push_inscricoes
  for delete using (colaborador_id = (select auth.uid()));
