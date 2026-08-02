-- F8: molde de card recorrente. kanban-clone.ts ja clona um quadro inteiro; o
-- que faltava era o molde de um card so, para o trabalho que se repete com a
-- mesma estrutura.
--
-- Os campos sao um subconjunto dos de `cartoes`, deliberadamente: prazo,
-- responsavel e coluna NAO entram. Prazo herdado sairia sempre errado, e
-- responsavel fixo transformaria o molde numa atribuicao automatica.
--
-- prioridade e tipo sao `text` com check, e nao enum, porque e assim que
-- `cartoes` os declara — divergir criaria conversao na hora de instanciar.
create table if not exists public.cartoes_templates (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.quadros(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  titulo text not null,
  descricao text,
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta')),
  tipo text not null default 'Padrão' check (tipo in ('Padrão','Bug','Melhoria','Solicitação')),
  tempo_estimado_min integer check (tempo_estimado_min is null or tempo_estimado_min > 0),
  criado_em timestamptz not null default now(),
  criado_por uuid references public.colaboradores(id),
  constraint cartoes_templates_nome_unico_por_quadro unique (quadro_id, nome)
);

create index if not exists idx_cartoes_templates_quadro_id on public.cartoes_templates (quadro_id);
create index if not exists idx_cartoes_templates_criado_por on public.cartoes_templates (criado_por);

alter table public.cartoes_templates enable row level security;
revoke all on public.cartoes_templates from anon;

create policy cartoes_templates_select_membro on public.cartoes_templates
  for select using (is_quadro_membro(quadro_id));
create policy cartoes_templates_insert_membro on public.cartoes_templates
  for insert with check (is_quadro_membro(quadro_id));
create policy cartoes_templates_update_membro on public.cartoes_templates
  for update using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));
create policy cartoes_templates_delete_membro on public.cartoes_templates
  for delete using (is_quadro_membro(quadro_id));
