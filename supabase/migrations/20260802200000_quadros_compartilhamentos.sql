-- F20: link de leitura para quem esta fora — cliente acompanhando um quadro sem
-- virar colaborador.
--
-- DECISAO DE SEGURANCA: esta tabela NAO recebe policy para `anon` e o `anon` nao
-- tem grant nela. A rota publica /q/[token] le pelo cliente de servico, no
-- servidor, e monta a resposta a mao com os campos que decidiu expor
-- (lib/compartilhamento.ts, funcao paraPublico).
--
-- A alternativa — dar policy de leitura ao anon em quadros/colunas/cartoes,
-- filtrada por token — seria mais curta e muito pior: qualquer erro futuro numa
-- dessas policies vaza quadro inteiro para a internet, e a superficie cresce a
-- cada tabela nova que se relacione com cartoes. Aqui o que sai e exatamente o
-- que o route handler escreve, e nada mais.
create table if not exists public.quadros_compartilhamentos (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros(id) on delete cascade,
  -- 32 bytes de gen_random_bytes (pgcrypto, ja habilitado pelo Supabase).
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  rotulo text not null check (length(trim(rotulo)) > 0),
  -- Sem validade o link vira permanente por esquecimento. Nulo e permitido, mas
  -- a interface pede prazo.
  expira_em timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.colaboradores(id),
  ultimo_acesso_em timestamptz
);

create index if not exists idx_quadros_compartilhamentos_quadro_id on public.quadros_compartilhamentos (quadro_id);
create index if not exists idx_quadros_compartilhamentos_criado_por on public.quadros_compartilhamentos (criado_por);

alter table public.quadros_compartilhamentos enable row level security;
-- Explicito, ainda que redundante com o default: nenhum acesso anonimo.
revoke all on public.quadros_compartilhamentos from anon;

create policy compartilhamentos_select_membro on public.quadros_compartilhamentos
  for select using (is_quadro_membro(quadro_id));
create policy compartilhamentos_insert_membro on public.quadros_compartilhamentos
  for insert with check (is_quadro_membro(quadro_id));
create policy compartilhamentos_update_membro on public.quadros_compartilhamentos
  for update using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));
create policy compartilhamentos_delete_membro on public.quadros_compartilhamentos
  for delete using (is_quadro_membro(quadro_id));
