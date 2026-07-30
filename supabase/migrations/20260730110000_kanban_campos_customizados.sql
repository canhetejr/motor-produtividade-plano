-- Campos customizados por quadro.
--
-- Motivação: a instância de referência (Runrun.it, quadro "OPERAÇÃO EAD")
-- tem metade da sidebar do card em campos que não existem neste schema —
-- Período de Oferta, Solicitação, Coordenador, Organização do JACAD, Status
-- Deferimento, Repositorio. São campos do QUADRO (todo card daquele quadro
-- vê a mesma lista), no mesmo espírito de `colunas_requisitos`, que já é uma
-- definição presa à etapa com status por card.
--
-- Por que `valor jsonb` numa coluna só em vez de uma coluna por tipo: são
-- sete tipos e a alternativa (valor_texto/valor_numero/valor_data/...) obriga
-- toda leitura a saber qual coluna olhar. O preço é a validação sair do
-- banco — ela fica no Zod da action, mesma divisão de trabalho que
-- `cartaoSchema` em app/(app)/kanban/actions.ts já usa.

begin;

create table if not exists quadros_campos (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  tipo text not null check (tipo in ('texto', 'numero', 'data', 'selecao', 'pessoa', 'checkbox', 'url')),
  -- Só faz sentido em tipo = 'selecao'; vazio nos demais.
  opcoes text[] not null default '{}',
  obrigatorio boolean not null default false,
  posicao integer not null default 0,
  created_at timestamptz not null default now(),
  unique (quadro_id, nome)
);

create index if not exists quadros_campos_quadro_idx on quadros_campos (quadro_id, posicao);

create table if not exists cartoes_campos_valores (
  cartao_id uuid references cartoes(id) on delete cascade not null,
  campo_id uuid references quadros_campos(id) on delete cascade not null,
  valor jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (cartao_id, campo_id)
);

commit;

begin;

alter table quadros_campos enable row level security;
alter table cartoes_campos_valores enable row level security;

drop policy if exists "quadros_campos_all_membro" on quadros_campos;
create policy "quadros_campos_all_membro" on quadros_campos for all
  using (is_quadro_membro(quadro_id))
  with check (is_quadro_membro(quadro_id));

drop policy if exists "cartoes_campos_valores_all_membro" on cartoes_campos_valores;
create policy "cartoes_campos_valores_all_membro" on cartoes_campos_valores for all
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_campos_valores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  )
  with check (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_campos_valores.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

revoke all on quadros_campos, cartoes_campos_valores from anon;

commit;
