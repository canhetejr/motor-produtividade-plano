-- Admin global: um nível acima de gestor.
--
-- Hoje `role` só aceita ('colaborador', 'gestor') e o gestor é superusuário
-- sem teto — cria conta, promove qualquer um a gestor, reseta senha de
-- qualquer um. Não há separação entre "gerente de equipe" e "dono do sistema".
--
-- POR QUE UMA COLUNA E NÃO role = 'admin':
-- existem 33 policies escritas como `auth_role() = 'gestor'`. Trocar o role de
-- alguém para 'admin' tornaria essa condição FALSA — o admin nasceria com
-- MENOS acesso que um gestor comum, quebrando as 33 de uma vez. A coluna é
-- aditiva: nenhuma policy existente muda, e o check abaixo garante no banco
-- que admin ⊃ gestor, então nenhuma precisa ganhar `or auth_is_admin()`.

begin;

alter table colaboradores add column if not exists admin boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'colaboradores_admin_exige_gestor'
  ) then
    alter table colaboradores add constraint colaboradores_admin_exige_gestor
      check (not admin or role = 'gestor');
  end if;
end;
$$;

-- Espelha auth_role(), inclusive o `and ativo = true` que a migration
-- 20260722015000 adicionou: admin desativado em /catalogo perde o poder na
-- hora, não quando a sessão Auth expirar sozinha.
create or replace function public.auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select admin from public.colaboradores where id = auth.uid() and ativo = true),
    false
  )
$$;

commit;


begin;

-- O buraco que este trigger fecha:
-- a policy `colaboradores_update_gestor` (migration 0002) permite a QUALQUER
-- gestor dar UPDATE em QUALQUER linha de colaboradores, e RLS no Postgres não
-- faz controle por coluna. Sem isto, um gestor se auto-promove a admin com um
-- PATCH direto no PostgREST, sem passar por nenhuma tela:
--   PATCH /rest/v1/colaboradores?id=eq.<self>  {"admin": true}
-- A checagem na Server Action é conveniência; a trava é aqui.
create or replace function public.colaboradores_proteger_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role não tem auth.uid(): são os crons e a criação de contas, que
  -- já ignoram RLS por definição. Deixar passar aqui não abaixa a barra.
  if auth.uid() is null then
    return new;
  end if;

  if auth_is_admin() then
    return new;
  end if;

  if new.admin is distinct from old.admin then
    raise exception 'APENAS_ADMIN: só um admin pode conceder ou revogar acesso de admin';
  end if;

  -- Um gestor não rebaixa nem desativa um admin. Sem isto a separação de
  -- privilégio seria contornável pelo caminho oposto: desative o admin e ele
  -- perde tudo (auth_is_admin() checa ativo).
  if old.admin and (
    new.role is distinct from old.role or new.ativo is distinct from old.ativo
  ) then
    raise exception 'APENAS_ADMIN: só um admin pode alterar o papel ou o acesso de outro admin';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_colaboradores_proteger_admin on colaboradores;
create trigger trg_colaboradores_proteger_admin
  before update on colaboradores
  for each row execute function public.colaboradores_proteger_admin();

commit;


begin;

-- Conceder/revogar admin passa por aqui em vez de por um UPDATE com service
-- role: a checagem mora junto da escrita, então não existe caminho de código
-- que esqueça de checar.
create or replace function public.definir_admin(
  p_colaborador_id uuid,
  p_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_restantes integer;
begin
  if not auth_is_admin() then
    raise exception 'APENAS_ADMIN: só um admin pode conceder ou revogar acesso de admin';
  end if;

  select role into v_role from colaboradores where id = p_colaborador_id;
  if not found then
    raise exception 'COLABORADOR_INEXISTENTE: colaborador não encontrado';
  end if;

  if p_admin then
    -- O check colaboradores_admin_exige_gestor recusaria de qualquer forma,
    -- mas com uma mensagem de constraint que não explica o que fazer.
    if v_role <> 'gestor' then
      raise exception 'PRECISA_SER_GESTOR: promova a gestor antes de conceder acesso de admin';
    end if;
  else
    -- Ficar sem nenhum admin deixaria o console inacessível para sempre —
    -- não há tela para conceder o primeiro de volta.
    select count(*) into v_restantes
    from colaboradores
    where admin and ativo and id <> p_colaborador_id;

    if v_restantes = 0 then
      raise exception 'ULTIMO_ADMIN: o sistema precisa de pelo menos um admin ativo';
    end if;
  end if;

  update colaboradores set admin = p_admin where id = p_colaborador_id;
end;
$$;

revoke all on function public.definir_admin(uuid, boolean) from public;
grant execute on function public.definir_admin(uuid, boolean) to authenticated;

commit;


begin;

-- ---------------------------------------------------------------------
-- SEED DO PRIMEIRO ADMIN — JÁ APLICADO em 31/07/2026.
--
-- Concedido a luizfernando.junior@unicive.edu.br (colaborador "Luiz | Admin"),
-- confirmado por query no banco real. O bloco é auto-inibido: sai sem fazer
-- nada se já existir qualquer admin, então re-rodar o arquivo não reconcede
-- acesso a quem tiver sido rebaixado de propósito.
--
-- Sem este seed o console nasceria inacessível: ninguém é admin, e só um
-- admin concede admin. Falha alto de propósito — um e-mail com typo criaria
-- zero admins em silêncio e a tela responderia com um redirect inexplicável.
-- ---------------------------------------------------------------------
do $$
declare
  v_email constant text := 'luizfernando.junior@unicive.edu.br';
  v_id uuid;
begin
  -- Se já existe algum admin, este bloco não faz nada: rodar o arquivo
  -- inteiro de novo não deve reconceder acesso a quem foi rebaixado de
  -- propósito.
  if exists (select 1 from colaboradores where admin) then
    raise notice 'Já existe admin — seed ignorado.';
    return;
  end if;

  select c.id into v_id
  from colaboradores c
  join auth.users u on u.id = c.id
  where lower(u.email) = lower(v_email);

  if v_id is null then
    raise exception
      'Nenhuma conta com o e-mail %. Troque o valor de v_email no seed do bloco 33 pelo seu login e rode de novo.',
      v_email;
  end if;

  -- admin exige gestor (constraint colaboradores_admin_exige_gestor).
  update colaboradores set role = 'gestor', admin = true where id = v_id;

  raise notice 'Admin concedido a % (%).', v_email, v_id;
end;
$$;

commit;
