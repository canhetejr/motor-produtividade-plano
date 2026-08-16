-- Escrita via MCP (docs/PLANO-MCP-PRODUTO.md, Gate 7). Quatro peças, todas
-- pensadas para o mesmo modo de falha: o servidor MCP roda inteiramente com
-- service role, então RLS não protege nada aqui — cada caminho de escrita
-- precisa carregar sua própria checagem de organização, à mão, ou vira uma
-- porta de escrita cross-tenant (skill vertice-isolamento, regra 4).
--
-- 1. Escopos validados no banco, não só no Zod da Server Action.
-- 2. registrar_apontamento_para(): a regra de negócio de apontamento passa a
--    existir uma vez só, parametrizada por colaborador, em vez de ser
--    reescrita em TypeScript para o MCP.
-- 3. pode_acessar_quadro(): mesma pergunta de is_quadro_membro(), mas
--    respondível sem auth.uid() — que é NULL sob service role.
-- 4. mcp_escritas: trilha de auditoria + chave de idempotência, para que
--    reenvio de uma mesma chamada (agente que perdeu a resposta e repetiu)
--    não crie dois apontamentos.

-- ============================================================
-- 1. Escopos válidos como constraint de banco
-- ============================================================
-- Gate 5, item 5 do plano: array não vazio, valores permitidos, sem
-- duplicatas. A Server Action já valida, mas ela não é o único caminho até a
-- tabela — qualquer insert por service role (script, correção manual, um
-- futuro endpoint) passa por aqui e não por lá.
create or replace function public.mcp_escopos_validos(p_escopos text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_escopos is not null
     and coalesce(array_length(p_escopos, 1), 0) >= 1
     and p_escopos <@ array[
           'apontamento:leitura',
           'apontamento:escrita',
           'kanban:leitura',
           'kanban:escrita'
         ]::text[]
     and array_length(p_escopos, 1) = (select count(distinct e) from unnest(p_escopos) e)
$$;

comment on function public.mcp_escopos_validos(text[]) is
  'Escopos MCP aceitos. Ao adicionar um escopo novo, edite aqui E em lib/mcp-auth.ts (ESCOPOS_MCP_DISPONIVEIS) — os dois lados precisam concordar.';

alter table public.mcp_tokens drop constraint if exists mcp_tokens_escopos_validos;
-- NOT VALID de propósito: a coluna nasceu com default '{}' em
-- 20260812150000_mcp_tokens.sql, e não dá para afirmar daqui que nenhuma
-- linha antiga ficou com array vazio. NOT VALID já barra todo INSERT/UPDATE
-- novo — que é o objetivo — sem arriscar falhar a migration em produção por
-- causa de uma linha histórica. Para validar o passado depois de conferir:
--   select id from public.mcp_tokens where not public.mcp_escopos_validos(escopos);
--   alter table public.mcp_tokens validate constraint mcp_tokens_escopos_validos;
alter table public.mcp_tokens
  add constraint mcp_tokens_escopos_validos
  check (public.mcp_escopos_validos(escopos)) not valid;

-- O default '{}' contradiz a constraint: um insert que omita escopos passaria
-- a falhar com erro de check em vez de gravar um token inútil. Preferível
-- exigir a coluna explicitamente.
alter table public.mcp_tokens alter column escopos drop default;

-- FK composta de mcp_escritas (abaixo) precisa deste par único —
-- skill vertice-isolamento, regra 3.
alter table public.mcp_tokens drop constraint if exists mcp_tokens_id_org;
alter table public.mcp_tokens add constraint mcp_tokens_id_org unique (id, organizacao_id);

-- ============================================================
-- 2. registrar_apontamento_para — a regra de negócio, sem auth.uid()
-- ============================================================
-- registrar_apontamento() (20260809150000) deriva o colaborador de
-- auth.uid(). O MCP não tem sessão: o projeto assina com JWT Signing Keys
-- assimétricas e não existe segredo simétrico para forjar um JWT de
-- impersonação (ver lib/mcp-auth.ts). A saída NÃO é reescrever as regras em
-- TypeScript — motivo/teto de blocos/demanda finita/carga horária ficariam
-- em dois lugares, e o dia em que um mudasse só num deles ninguém veria.
-- Em vez disso, o corpo inteiro passa a viver aqui, com o colaborador como
-- parâmetro, e registrar_apontamento() vira um wrapper de uma linha.
--
-- Deliberadamente SEM parâmetro de data: lançamento retroativo continua
-- exigindo o fluxo de correção com aprovação de gestor
-- (apontamentos_correcoes). Um agente de IA não ganha, por MCP, um poder que
-- a interface não dá a quem o operou.
create or replace function public.registrar_apontamento_para(
  p_colaborador_id uuid,
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
)
returns apontamentos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_acumulado numeric;
  v_row apontamentos;
  v_organizacao_id uuid;
begin
  if p_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min, organizacao_id into v_carga_horaria_min, v_organizacao_id
  from colaboradores
  where id = p_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  -- p_demanda_id vem de fora: sem o filtro, um id de outra organização
  -- criaria apontamento vinculado a uma demanda que não é a sua. A
  -- organização vem da linha do colaborador (fonte confiável), nunca de
  -- parâmetro — sob service role não há org_atual() a que recorrer.
  select variavel, tempo_padrao_min, blocos_totais, ativo, finita
  into v_demanda
  from demandas
  where id = p_demanda_id and organizacao_id = v_organizacao_id;

  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  if v_demanda.variavel then
    if p_tempo_manual_min is null or p_tempo_manual_min <= 0 then
      raise exception 'TEMPO_OBRIGATORIO';
    end if;
    if p_tempo_manual_min > v_carga_horaria_min then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
    if v_motivo is null or v_motivo not in
      ('Reunião', 'Treinamento', 'Suporte a colega', 'Retrabalho', 'Imprevisto', 'Outro')
    then
      raise exception 'MOTIVO_INVALIDO';
    end if;
    if v_motivo = 'Outro' and coalesce(trim(p_observacoes), '') = '' then
      raise exception 'OBSERVACAO_OBRIGATORIA';
    end if;
  else
    v_motivo := null;
    if v_demanda.tempo_padrao_min is null then
      raise exception 'DEMANDA_SEM_TEMPO_PADRAO';
    end if;
    if v_demanda.blocos_totais > 1 and p_quantidade > v_demanda.blocos_totais then
      raise exception 'BLOCOS_EXCEDIDOS';
    end if;
    if v_demanda.finita then
      select coalesce(sum(quantidade), 0) into v_acumulado
      from apontamentos
      where demanda_id = p_demanda_id;

      if v_acumulado + p_quantidade > v_demanda.blocos_totais then
        raise exception 'BLOCOS_FINITOS_ESGOTADOS';
      end if;
    end if;
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, quantidade, tempo_manual_min, motivo, observacoes,
    data, tempo_padrao_snapshot, blocos_totais_snapshot, organizacao_id
  ) values (
    p_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes,
    current_date,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end,
    v_organizacao_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- Só service_role executa: esta função aceita QUALQUER colaborador como
-- parâmetro. Se `authenticated` pudesse chamá-la, um usuário logado
-- registraria apontamento no nome de um colega — exatamente o que o
-- auth.uid() do wrapper impede. O MCP chega por service role
-- (lib/mcp/mutations.ts) já tendo resolvido o colaborador pelo token.
revoke all on function public.registrar_apontamento_para(uuid, uuid, numeric, integer, text, text) from public;
revoke all on function public.registrar_apontamento_para(uuid, uuid, numeric, integer, text, text) from anon, authenticated;
grant execute on function public.registrar_apontamento_para(uuid, uuid, numeric, integer, text, text) to service_role;

-- O wrapper preserva a assinatura e os grants que a UI já usa
-- (app/(app)/apontamento/actions.ts). Comportamento idêntico ao anterior:
-- mesmas exceções, mesma linha de retorno.
create or replace function public.registrar_apontamento(
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
)
returns apontamentos
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return public.registrar_apontamento_para(
    auth.uid(), p_demanda_id, p_quantidade, p_tempo_manual_min, p_motivo, p_observacoes
  );
end;
$function$;

revoke all on function public.registrar_apontamento(uuid, numeric, integer, text, text) from public;
revoke all on function public.registrar_apontamento(uuid, numeric, integer, text, text) from anon;
grant execute on function public.registrar_apontamento(uuid, numeric, integer, text, text) to authenticated, service_role;

-- ============================================================
-- 3. pode_acessar_quadro — a mesma regra de is_quadro_membro, sem sessão
-- ============================================================
-- is_quadro_membro() responde "gestor OU membro" para auth.uid(). Sob
-- service role auth.uid() é NULL e a função devolve false para tudo — o que
-- levaria o MCP a reimplementar a regra por fora. Mesmo tratamento do
-- apontamento: a regra passa a existir uma vez, parametrizada, e
-- is_quadro_membro() delega.
create or replace function public.pode_acessar_quadro(p_quadro_id uuid, p_colaborador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    -- O colaborador precisa ser gestor ATIVO da MESMA organização do quadro:
    -- sem o par (organizacao_id do quadro = organizacao_id do colaborador),
    -- um gestor da organização A responderia "true" para um quadro da B.
    select 1
    from colaboradores c
    join quadros q on q.id = p_quadro_id and q.organizacao_id = c.organizacao_id
    where c.id = p_colaborador_id and c.ativo = true and c.role = 'gestor'
  ) or exists (
    select 1
    from quadros_membros m
    join colaboradores c on c.id = m.colaborador_id and c.organizacao_id = m.organizacao_id
    where m.quadro_id = p_quadro_id and m.colaborador_id = p_colaborador_id and c.ativo = true
  )
$$;

-- Sem grant para `authenticated`: quem está logado chega aqui por dentro de
-- is_quadro_membro(), que é SECURITY DEFINER e executa com o privilégio do
-- dono. Exposta em /rest/v1/rpc, esta função responderia "fulano é membro do
-- quadro tal?" para qualquer par de ids — uma sonda de existência que a
-- versão sem parâmetro não oferece.
revoke all on function public.pode_acessar_quadro(uuid, uuid) from public;
revoke all on function public.pode_acessar_quadro(uuid, uuid) from anon, authenticated;
grant execute on function public.pode_acessar_quadro(uuid, uuid) to service_role;

-- Comportamento preservado para todas as políticas que já chamam
-- is_quadro_membro(): auth_role() = 'gestor' já embutia ativo = true
-- (20260722015000) e a sessão só existe dentro da própria organização.
create or replace function public.is_quadro_membro(p_quadro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pode_acessar_quadro(p_quadro_id, auth.uid())
$$;

revoke all on function public.is_quadro_membro(uuid) from public;
grant execute on function public.is_quadro_membro(uuid) to authenticated, service_role;

-- ============================================================
-- 4. mcp_escritas — auditoria e idempotência das escritas via MCP
-- ============================================================
-- Duas funções num registro só, porque são a mesma linha do ponto de vista
-- do domínio: "esta chamada de escrita, deste token, já aconteceu — e foi
-- isto que ela produziu". O reenvio de um agente que perdeu a resposta cai
-- no índice único e devolve o resultado gravado em vez de criar um segundo
-- apontamento.
create table if not exists public.mcp_escritas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null,
  token_id uuid not null,
  colaborador_id uuid not null,
  ferramenta text not null,
  chave_idempotencia text not null,
  entidade text not null,
  entidade_id uuid,
  -- Só identificadores e rótulos do que foi criado/alterado; nunca o payload
  -- bruto da chamada nem o token. Gate 4 do plano.
  resultado jsonb not null,
  criado_em timestamptz not null default now(),

  constraint mcp_escritas_token_org
    foreign key (token_id, organizacao_id)
    references public.mcp_tokens (id, organizacao_id) on delete cascade,
  constraint mcp_escritas_colaborador_org
    foreign key (colaborador_id, organizacao_id)
    references public.colaboradores (id, organizacao_id) on delete cascade
);

-- A idempotência é por token, não por organização: dois tokens do mesmo
-- colaborador são dois clientes distintos e não devem se anular.
create unique index if not exists idx_mcp_escritas_idempotencia
  on public.mcp_escritas (token_id, ferramenta, chave_idempotencia);

-- Serve à política do eixo e à consulta "o que este token andou fazendo".
create index if not exists idx_mcp_escritas_organizacao on public.mcp_escritas (organizacao_id);
create index if not exists idx_mcp_escritas_token_criado on public.mcp_escritas (token_id, criado_em desc);
-- Par exigido pela FK composta de colaborador: sem ele, apagar um
-- colaborador vira seq scan nesta tabela conforme ela cresce.
create index if not exists idx_mcp_escritas_colaborador_organizacao
  on public.mcp_escritas (colaborador_id, organizacao_id);

alter table public.mcp_escritas enable row level security;

-- Restritiva, nunca permissiva (skill vertice-isolamento, regra 1): entra com
-- AND sobre qualquer política que venha a existir aqui.
drop policy if exists "mcp_escritas_org" on public.mcp_escritas;
create policy "mcp_escritas_org" on public.mcp_escritas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

-- Leitura própria para o colaborador: é o dado que a tela de Perfil precisa
-- para responder "o que meu token fez". Nenhuma política de INSERT/UPDATE/
-- DELETE para authenticated — a trilha é escrita só por service role, de
-- dentro de lib/mcp/mutations.ts, e não deve ser editável por quem a gerou.
drop policy if exists "mcp_escritas_proprio_select" on public.mcp_escritas;
create policy "mcp_escritas_proprio_select" on public.mcp_escritas
  as permissive for select
  to authenticated
  using (
    colaborador_id = (select auth.uid())
    and organizacao_id = (select public.org_atual())
  );

comment on table public.mcp_escritas is
  'Trilha de escrita do servidor MCP: uma linha por chamada de tool de escrita bem-sucedida. Serve de auditoria e de chave de idempotência. Nunca guarda token, hash ou payload bruto.';
