-- Dono da organização: quem responde pela empresa dentro do Vértice.
--
-- Hoje `organizacoes` não registra quem criou nem quem responde por ela.
-- criar_organizacao (20260809180000) faz o criador nascer gestor+admin, e na
-- prática ele *é* o dono — mas isso só existe como intenção, não como dado, e
-- a Teralabs (semeada por migration de dado na Fase 1) nunca passou por esse
-- caminho.
--
-- POR QUE UMA COLUNA EM organizacoes E NÃO colaboradores.dono:
-- a coluna aqui garante "exatamente um dono por organização" por construção.
-- Um booleano em colaboradores dependeria de índice parcial único mais lógica
-- de aplicação para não permitir dois — a mesma classe de invariante que este
-- projeto já prefere resolver no schema (ver FKs compostas do eixo).
--
-- POR QUE NÃO É role = 'dono':
-- pelo mesmo motivo que admin virou coluna em 20260731100000 — existem ~33
-- policies escritas como `auth_role() = 'gestor'`, e trocar o role do dono o
-- faria nascer com MENOS acesso que um gestor comum.

begin;

-- Chicken-and-egg deliberado: criar_organizacao insere organizacoes ANTES de
-- colaboradores (colaboradores.organizacao_id é FK para organizacoes), então
-- dono_colaborador_id não pode ser NOT NULL — na primeira instrução do INSERT
-- o colaborador ainda não existe. A garantia "toda organização tem dono" fica
-- por fora do NOT NULL: (a) a coluna só é escrita pelas duas RPCs abaixo e por
-- criar_organizacao, nunca por UPDATE direto (organizacoes não tem policy de
-- update para authenticated — só a de leitura de 20260808170000); (b) o
-- diagnóstico de lib/admin-diagnostico.ts monitora zero linhas com dono nulo.
alter table public.organizacoes add column if not exists dono_colaborador_id uuid;

-- FK composta contra colaboradores(id, organizacao_id) — a mesma unique que
-- 20260808170000 criou (colaboradores_id_org). É o que torna impossível o dono
-- de uma organização ser colaborador de outra, mesmo que um caminho de escrita
-- futuro esqueça de checar.
--
-- MATCH SIMPLE (o padrão): com dono_colaborador_id nulo a constraint não
-- valida nada, que é exatamente o desejado enquanto o backfill não rodou.
-- MATCH FULL quebraria toda organização ainda sem dono.
--
-- on delete: nenhum. Apagar um colaborador que é dono precisa falhar alto —
-- uma organização sem dono é o estado que esta migration existe para evitar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizacoes_dono_org') then
    alter table public.organizacoes
      add constraint organizacoes_dono_org
      foreign key (dono_colaborador_id, id)
      references public.colaboradores (id, organizacao_id);
  end if;
end $$;

comment on column public.organizacoes.dono_colaborador_id is
  'Colaborador que responde pela empresa: único que edita o nome da '
  'organização e transfere a propriedade. Nulável só por ordem de inserção '
  '(ver comentário da migration 20260812200000); zero nulos é o estado '
  'esperado e é monitorado pelo diagnóstico da /gestao/sistema.';

-- ============================================================
-- Backfill
-- ============================================================

-- Teralabs (organização nº 1, migrada de um sistema pré-multi-inquilino): o
-- dono é o colaborador "Luiz | Admin", por decisão de produto explícita — NÃO
-- por heurística de data de criação.
--
-- O e-mail é procurado numa lista de candidatos porque a conta dessa pessoa já
-- mudou de endereço uma vez: o seed do bloco 33 (20260731100000) usa
-- luizfernando.junior@unicive.edu.br e o domínio atual da Tera é
-- teralabs.cloud. Procurar os dois e falhar alto se nenhum existir é melhor do
-- que fixar um e deixar a organização sem dono em silêncio.
do $$
declare
  v_candidatos constant text[] := array['canhete@teralabs.cloud', 'luizfernando.junior@unicive.edu.br'];
  v_org constant uuid := '00000000-0000-0000-0000-000000000001';
  v_email text;
  v_id uuid;
begin
  -- Organização nº 1 pode não existir em bancos de integração criados do
  -- zero — ali não há nada para fazer.
  if not exists (select 1 from public.organizacoes where id = v_org) then
    raise notice 'Organização Teralabs ausente — backfill dedicado ignorado.';
    return;
  end if;

  foreach v_email in array v_candidatos loop
    select c.id into v_id
    from public.colaboradores c
    join auth.users u on u.id = c.id
    where lower(u.email) = lower(v_email)
      and c.organizacao_id = v_org
      and c.ativo = true;

    exit when v_id is not null;
  end loop;

  if v_id is null then
    raise exception
      'BOOTSTRAP_TERALABS_FALHOU: nenhum dos e-mails % é colaborador ativo da organização Teralabs. Ajuste a lista de candidatos antes de aplicar.',
      v_candidatos;
  end if;

  -- admin exige gestor (constraint colaboradores_admin_exige_gestor), e o
  -- dono precisa ser admin — ver trg_colaboradores_proteger_dono abaixo.
  update public.colaboradores set role = 'gestor', admin = true
  where id = v_id and not (role = 'gestor' and admin);

  update public.organizacoes set dono_colaborador_id = v_id where id = v_org;

  raise notice 'Dono da Teralabs definido: % (%).', v_email, v_id;
end $$;

-- Demais organizações (cadastros públicos da Fase 7 já existentes): dono é o
-- gestor+admin ativo mais antigo por auth.users.created_at.
--
-- Diferente da Teralabs, aqui a ordem de criação NÃO é heurística frouxa: quem
-- passou por /cadastro é literalmente o primeiro colaborador da organização,
-- criado por criar_organizacao na mesma transação da própria empresa.
update public.organizacoes o
set dono_colaborador_id = (
  select c.id
  from public.colaboradores c
  join auth.users u on u.id = c.id
  where c.organizacao_id = o.id
    and c.role = 'gestor'
    and c.admin = true
    and c.ativo = true
  order by u.created_at asc
  limit 1
)
where o.id <> '00000000-0000-0000-0000-000000000001'
  and o.dono_colaborador_id is null;

commit;


begin;

-- ============================================================
-- Invariante dono ⊂ admin
-- ============================================================

-- Espelha trg_colaboradores_proteger_admin (20260731100000): sem isto, um
-- admin revoga o admin do dono e a organização fica com um dono que não
-- consegue nem abrir a /gestao/sistema onde a transferência mora — um beco sem
-- saída silencioso, já que só o dono transfere a propriedade.
--
-- Desativar o dono cai na mesma trava: auth_is_admin() checa `ativo`, então um
-- dono inativo é indistinguível de um dono sem admin para efeito de acesso.
create or replace function public.colaboradores_proteger_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role não tem auth.uid(): crons e criação de conta. Mesmo critério
  -- de colaboradores_proteger_admin — eles já ignoram RLS por definição.
  if auth.uid() is null then
    return new;
  end if;

  if not exists (select 1 from public.organizacoes where dono_colaborador_id = old.id) then
    return new;
  end if;

  if old.admin and not new.admin then
    raise exception 'DONO_NAO_PODE_PERDER_ADMIN: transfira a propriedade da empresa antes de revogar o acesso de admin desta pessoa';
  end if;

  if old.ativo and not new.ativo then
    raise exception 'DONO_NAO_PODE_SER_DESATIVADO: transfira a propriedade da empresa antes de desativar esta pessoa';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_colaboradores_proteger_dono on public.colaboradores;
create trigger trg_colaboradores_proteger_dono
  before update on public.colaboradores
  for each row execute function public.colaboradores_proteger_dono();

commit;


begin;

-- ============================================================
-- RPC 1 — editar o nome da empresa
-- ============================================================

-- Rota única de escrita: organizacoes continua sem policy de UPDATE para
-- authenticated. Mesma decisão de criar_organizacao/definir_admin — escrita
-- sensível fica atrás de uma função que carrega a checagem junto, em vez de
-- uma policy de UPDATE que o PostgREST expõe diretamente.
--
-- SECURITY DEFINER ignora RLS: a checagem de organização é escrita à mão
-- abaixo (org_atual() + comparação com o dono), como manda a regra 4 da skill
-- vertice-isolamento.
create or replace function public.atualizar_nome_organizacao(p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.org_atual();
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if v_org_id is null then
    raise exception 'ORGANIZACAO_INATIVA';
  end if;

  if (select dono_colaborador_id from public.organizacoes where id = v_org_id)
     is distinct from auth.uid() then
    raise exception 'APENAS_DONO: só o dono da empresa pode editar o nome dela';
  end if;

  if v_nome = '' then
    raise exception 'NOME_INVALIDO: o nome da empresa não pode ficar em branco';
  end if;

  if length(v_nome) > 120 then
    raise exception 'NOME_INVALIDO: o nome da empresa deve ter no máximo 120 caracteres';
  end if;

  update public.organizacoes set nome = v_nome where id = v_org_id;
end;
$$;

revoke all on function public.atualizar_nome_organizacao(text) from public, anon;
grant execute on function public.atualizar_nome_organizacao(text) to authenticated;

-- ============================================================
-- RPC 2 — transferir a propriedade
-- ============================================================

-- O dono anterior NÃO é rebaixado de admin. Duas razões: evita o cenário "a
-- organização ficou sem nenhum admin" (o mesmo cuidado do ULTIMO_ADMIN em
-- definir_admin), e mantém a transferência reversível pelo próprio ex-dono
-- durante a conversa em que ela aconteceu.
create or replace function public.transferir_propriedade_organizacao(p_novo_dono_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.org_atual();
  v_alvo record;
begin
  if v_org_id is null then
    raise exception 'ORGANIZACAO_INATIVA';
  end if;

  if (select dono_colaborador_id from public.organizacoes where id = v_org_id)
     is distinct from auth.uid() then
    raise exception 'APENAS_DONO: só o dono atual pode transferir a propriedade da empresa';
  end if;

  if p_novo_dono_id = auth.uid() then
    raise exception 'JA_E_DONO: esta pessoa já é a dona da empresa';
  end if;

  -- Lê colaboradores sem filtro de organização de propósito e compara depois:
  -- assim um id de OUTRA organização cai em COLABORADOR_INVALIDO (mensagem
  -- correta) em vez de "não encontrado" (mensagem que sugere id digitado
  -- errado). A função é SECURITY DEFINER, então este select enxerga todas as
  -- linhas — a comparação abaixo é a única coisa que segura o cross-tenant.
  select role, ativo, organizacao_id into v_alvo
  from public.colaboradores
  where id = p_novo_dono_id;

  if not found or v_alvo.organizacao_id is distinct from v_org_id then
    raise exception 'COLABORADOR_INVALIDO: a pessoa escolhida não pertence a esta empresa';
  end if;

  if not v_alvo.ativo then
    raise exception 'COLABORADOR_INATIVO: a pessoa escolhida está desativada';
  end if;

  if v_alvo.role <> 'gestor' then
    raise exception 'NAO_E_GESTOR: promova a pessoa a gestor antes de transferir a propriedade';
  end if;

  -- Promove a admin se ainda não for: dono ⊂ admin é invariante (ver
  -- trg_colaboradores_proteger_dono). Ordem importa — o trigger de proteção do
  -- dono lê organizacoes.dono_colaborador_id, que ainda aponta para o dono
  -- antigo neste ponto, então este update passa livre.
  update public.colaboradores set admin = true
  where id = p_novo_dono_id and not admin;

  update public.organizacoes set dono_colaborador_id = p_novo_dono_id where id = v_org_id;
end;
$$;

revoke all on function public.transferir_propriedade_organizacao(uuid) from public, anon;
grant execute on function public.transferir_propriedade_organizacao(uuid) to authenticated;

commit;


begin;

-- ============================================================
-- criar_organizacao passa a fixar o dono
-- ============================================================

-- Sem isto, toda organização nova nasceria sem dono até uma migration futura
-- de backfill — repetindo exatamente o problema que esta migration resolve.
-- `create or replace` reescreve a função; 20260809180000 continua intacto como
-- registro histórico.
create or replace function public.criar_organizacao(
  p_user_id uuid,
  p_nome_empresa text,
  p_nome_gestor text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_plano_id uuid;
  v_assentos integer;
  v_org_id uuid;
  v_area_id uuid;
  v_slug_base text;
  v_slug text;
begin
  select id, assentos_inclusos into v_plano_id, v_assentos
    from public.planos where codigo = 'trial' and ativo = true;

  if v_plano_id is null then
    raise exception 'PLANO_TRIAL_INDISPONIVEL';
  end if;

  if p_user_id is null or coalesce(trim(p_nome_empresa), '') = '' or coalesce(trim(p_nome_gestor), '') = '' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  v_slug_base := trim(both '-' from regexp_replace(lower(trim(p_nome_empresa)), '[^a-z0-9]+', '-', 'g'));
  if v_slug_base = '' then
    v_slug_base := 'empresa';
  end if;

  -- Sufixo aleatório em vez de depender de retry no chamador: nome de
  -- empresa repetido ("Padaria do João" em duas cidades) não pode falhar o
  -- cadastro por causa de slug duplicado.
  v_slug := v_slug_base || '-' || substr(md5(random()::text), 1, 6);
  while exists (select 1 from public.organizacoes where slug = v_slug) loop
    v_slug := v_slug_base || '-' || substr(md5(random()::text), 1, 6);
  end loop;

  insert into public.organizacoes (nome, slug, plano_id, limite_assentos, status, trial_expira_em)
  values (trim(p_nome_empresa), v_slug, v_plano_id, v_assentos, 'trialing', now() + interval '14 days')
  returning id into v_org_id;

  insert into public.areas (nome, organizacao_id) values ('Geral', v_org_id)
  returning id into v_area_id;

  -- role='gestor' + admin=true: quem cadastra a organização é o primeiro
  -- admin dela (a constraint colaboradores_admin_exige_gestor exige que
  -- admin implique gestor). O trigger trg_colaboradores_assentos roda neste
  -- insert (ativo=true) e confere 1 <= limite_assentos do plano trial.
  insert into public.colaboradores (id, nome, area_id, role, admin, ativo, organizacao_id)
  values (p_user_id, trim(p_nome_gestor), v_area_id, 'gestor', true, true, v_org_id);

  -- Quem cadastra é o dono. UPDATE e não INSERT com a coluna já preenchida:
  -- dono_colaborador_id referencia colaboradores(id, organizacao_id) pela FK
  -- composta, e o colaborador só passou a existir na instrução acima. Mesma
  -- transação — se qualquer coisa falhar daqui para trás, não sobra
  -- organização sem dono.
  update public.organizacoes set dono_colaborador_id = p_user_id where id = v_org_id;

  return v_org_id;
end;
$$;

-- Só a action de cadastro chama, via service role (que não passa por grant
-- de authenticated/anon) — mesmo padrão de transicionar_organizacoes.
revoke all on function public.criar_organizacao(uuid, text, text) from public, anon, authenticated;

commit;
