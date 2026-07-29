-- Anexos por card. Bucket privado (diferente do "avatars" público) — todo
-- upload/download passa pela Server Action com o client admin (mesmo
-- raciocínio de updateMeuAvatar em perfil/actions.ts: quem decide o path é o
-- código do servidor, então não precisa de policy de storage.objects; a
-- listagem usa signed URL de curta duração, nunca URL pública).

begin;

insert into storage.buckets (id, name, public)
values ('anexos-cartoes', 'anexos-cartoes', false)
on conflict (id) do nothing;

create table if not exists cartoes_anexos (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartoes(id) on delete cascade not null,
  colaborador_id uuid references colaboradores(id) not null,
  nome_arquivo text not null,
  caminho_storage text not null,
  tamanho_bytes bigint not null,
  tipo_mime text not null,
  created_at timestamptz not null default now()
);

create index if not exists cartoes_anexos_cartao_idx on cartoes_anexos (cartao_id, created_at desc);

commit;

begin;

alter table cartoes_anexos enable row level security;

drop policy if exists "cartoes_anexos_select_membro" on cartoes_anexos;
create policy "cartoes_anexos_select_membro" on cartoes_anexos for select
  using (
    exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_anexos.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

-- Insert/select via client admin nas actions (mesmo padrão de anexos em si);
-- ainda assim mantém RLS habilitado com policy de select pra leitura direta
-- eventual pelo client normal (ex.: contagem de anexos no card face a face).
drop policy if exists "cartoes_anexos_insert_membro" on cartoes_anexos;
create policy "cartoes_anexos_insert_membro" on cartoes_anexos for insert
  with check (
    colaborador_id = auth.uid()
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_anexos.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

drop policy if exists "cartoes_anexos_delete_own_or_gestor" on cartoes_anexos;
create policy "cartoes_anexos_delete_own_or_gestor" on cartoes_anexos for delete
  using (colaborador_id = auth.uid() or auth_role() = 'gestor');

revoke all on cartoes_anexos from anon;

commit;
