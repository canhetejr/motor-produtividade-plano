-- Produtividade: medir eficiência de execução (tempo esperado ÷ tempo real).
--
-- O único indicador que existe hoje é `indicadores_diarios.indice`, que é
-- "tempo entregue ÷ carga horária" — ocupação da jornada. E o "tempo
-- entregue" de uma demanda de tempo padrão é o PRÓPRIO tempo padrão
-- (apontamentos_calculado, 20260721070000), não o tempo que a pessoa gastou.
-- Consequência: quem faz a mesma demanda em 20 min e quem faz em 90 min
-- recebem crédito idêntico. Não existe, em lugar nenhum do produto, o número
-- que diz quem entrega mais rápido.
--
-- Este bloco cria esse número SEM tocar em `apontamentos_calculado` nem em
-- `indicadores_diarios`. As duas views alimentam dashboard, /relatorios,
-- metas, cron de alerta-queda e relatório semanal, tudo em produção; mexer
-- nelas para acrescentar métrica nova é trocar o motor com o carro andando.
-- A medição vira registro próprio em `produtividade_execucoes`, escrito nos
-- pontos de entrega. Os dois indicadores convivem, medindo coisas diferentes.
--
-- Regra que define quando existe medição: só há produtividade quando uma
-- unidade de trabalho foi CONCLUÍDA e o tempo real é CONHECIDO. Sessão de
-- cronômetro solta no Kanban é fatia de trabalho, não entrega — comparar 30
-- min de sessão contra um padrão de 120 min daria 25% de produtividade que é
-- puro artefato. Por isso o Kanban só mede na entrada em etapa final, e
-- `registrar_apontamento_timer` continua sem gerar medição nenhuma.

begin;

-- ---------------------------------------------------------------------
-- 1. Régua de complexidade, por organização
--
-- Demanda de tempo variável não tem esperado — é o que "variável" quer
-- dizer. Sem um esperado não há o que dividir, e ela ficaria fora da
-- produtividade para sempre. O nível de complexidade é o esperado
-- provisório: o gestor declara "isto costuma levar mais ou menos tanto",
-- e a demanda passa a ser medível até acumular execuções suficientes para
-- virar tempo fixo de verdade.
--
-- Os minutos ficam por organização, e não fixos no código, porque "alta
-- complexidade" numa contabilidade e numa agência não são o mesmo número.
-- ---------------------------------------------------------------------
create table if not exists public.complexidade_niveis (
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  nivel text not null check (nivel in ('baixa', 'media', 'alta', 'muito_alta')),
  minutos_referencia integer not null check (minutos_referencia > 0),
  atualizado_em timestamptz not null default now(),
  primary key (organizacao_id, nivel)
);

-- A PK já começa por organizacao_id, então serve à política do eixo — não
-- há índice isolado a criar aqui, diferente das tabelas com PK em `id`.

alter table public.complexidade_niveis enable row level security;
revoke all on public.complexidade_niveis from anon;

-- Restritiva, não permissiva (skill vertice-isolamento, regra 1): entra com
-- AND sobre as permissivas abaixo, em vez de ampliar o acesso com OR.
create policy "complexidade_niveis_org" on public.complexidade_niveis
  as restrictive for all
  to authenticated
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

-- Todo mundo lê (o colaborador precisa ver "Alta · 60 min" ao sugerir uma
-- demanda); só gestor calibra a régua.
create policy complexidade_niveis_select on public.complexidade_niveis
  for select to authenticated using ((select auth.uid()) is not null);
create policy complexidade_niveis_insert_gestor on public.complexidade_niveis
  for insert to authenticated with check ((select public.auth_role()) = 'gestor');
create policy complexidade_niveis_update_gestor on public.complexidade_niveis
  for update to authenticated
  using ((select public.auth_role()) = 'gestor')
  with check ((select public.auth_role()) = 'gestor');

-- Explícito em vez de depender do default privilege do schema public: o
-- projeto já revogou acesso de `anon` à mão duas vezes (0002 e 20260802150000)
-- justamente por não deixar o padrão decidir.
grant select, insert, update on public.complexidade_niveis to authenticated;

-- Padrões de partida. Não são lei — são o ponto onde a conversa começa, e a
-- tela de configurações existe justamente para o gestor discordar deles.
insert into public.complexidade_niveis (organizacao_id, nivel, minutos_referencia)
select o.id, v.nivel, v.minutos
from public.organizacoes o
cross join (values ('baixa', 15), ('media', 30), ('alta', 60), ('muito_alta', 120)) as v(nivel, minutos)
on conflict (organizacao_id, nivel) do nothing;

-- ---------------------------------------------------------------------
-- 2. Nível de complexidade na demanda
--
-- Sem constraint amarrando complexidade a variavel=true: a coerência é
-- normalizada em lib/demandas.ts::prepararDemanda, que é o caminho único de
-- gravação (cadastro, sugestão, aprovação e import passam todos por ele).
-- Uma CHECK aqui quebraria o import em massa por linha, que hoje corrige e
-- segue em vez de recusar.
-- ---------------------------------------------------------------------
alter table public.demandas
  add column if not exists complexidade text
  check (complexidade is null or complexidade in ('baixa', 'media', 'alta', 'muito_alta'));

alter table public.solicitacoes_demandas
  add column if not exists complexidade text
  check (complexidade is null or complexidade in ('baixa', 'media', 'alta', 'muito_alta'));

commit;

begin;

-- ---------------------------------------------------------------------
-- 3. O registro de medição
--
-- Uma linha = uma execução concluída com tempo real conhecido. Snapshots,
-- não referências: `tempo_esperado_min` é congelado na gravação pelo mesmo
-- motivo de `apontamentos.tempo_padrao_snapshot` existir (20260721070000) —
-- recalibrar a demanda amanhã não pode reescrever a produtividade de ontem.
-- ---------------------------------------------------------------------
create table if not exists public.produtividade_execucoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  colaborador_id uuid not null,
  demanda_id uuid not null,
  -- Snapshot da área da demanda: área pode ser renomeada ou a demanda
  -- movida, e o recorte por área do período passado deve continuar valendo.
  area_id uuid not null,

  origem text not null check (origem in ('apontamento', 'cartao')),
  -- Exatamente uma das duas origens preenchida. Sem isto, uma linha órfã de
  -- ambos os lados sobreviveria a qualquer cascade e contaria para sempre.
  apontamento_id uuid references public.apontamentos(id) on delete cascade,
  cartao_id uuid references public.cartoes(id) on delete cascade,
  constraint produtividade_execucoes_origem_coerente check (
    (origem = 'apontamento' and apontamento_id is not null and cartao_id is null)
    or (origem = 'cartao' and cartao_id is not null and apontamento_id is null)
  ),

  data date not null,
  quantidade numeric not null check (quantidade > 0),
  tempo_esperado_min integer not null check (tempo_esperado_min > 0),
  tempo_real_min integer not null check (tempo_real_min > 0),
  criado_em timestamptz not null default now(),

  -- FKs compostas (skill vertice-isolamento, regra 3): é o que torna
  -- estruturalmente impossível uma medição da org A apontar para a demanda
  -- ou o colaborador da org B. MATCH SIMPLE (padrão) de propósito — as duas
  -- colunas são NOT NULL aqui, mas a convenção do projeto é não escrever
  -- MATCH FULL nessas FKs.
  constraint produtividade_execucoes_colaborador_org
    foreign key (colaborador_id, organizacao_id)
    references public.colaboradores (id, organizacao_id) on delete cascade,
  constraint produtividade_execucoes_demanda_org
    foreign key (demanda_id, organizacao_id)
    references public.demandas (id, organizacao_id) on delete cascade,
  constraint produtividade_execucoes_area_org
    foreign key (area_id, organizacao_id)
    references public.areas (id, organizacao_id) on delete cascade
);

-- `apontamentos` não tem unique (id, organizacao_id) — não é pai de
-- ninguém no eixo (20260808170000/20260809100000 criaram a constraint só
-- nas raízes e em cartoes). A FK acima é simples de propósito; a coerência
-- de organização vem de quem grava, que é a RPC, e da FK composta de
-- colaborador/demanda, que já amarra a linha à organização certa.

-- Uma medição por apontamento e uma por cartão. Sem isto, reentrar numa
-- etapa final duplicaria a linha do cartão e a demanda apareceria com o
-- dobro de execuções.
create unique index if not exists produtividade_execucoes_apontamento_uk
  on public.produtividade_execucoes (apontamento_id) where apontamento_id is not null;
create unique index if not exists produtividade_execucoes_cartao_uk
  on public.produtividade_execucoes (cartao_id) where cartao_id is not null;

-- Serve à política do eixo: sem ele, filtrar por organizacao_id vira seq
-- scan conforme a tabela cresce.
create index if not exists produtividade_execucoes_org_data_idx
  on public.produtividade_execucoes (organizacao_id, data);
create index if not exists produtividade_execucoes_demanda_idx
  on public.produtividade_execucoes (demanda_id);
create index if not exists produtividade_execucoes_colaborador_idx
  on public.produtividade_execucoes (colaborador_id);

alter table public.produtividade_execucoes enable row level security;
revoke all on public.produtividade_execucoes from anon;

create policy "produtividade_execucoes_org" on public.produtividade_execucoes
  as restrictive for all
  to authenticated
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

-- Leitura para toda a organização (o painel do gestor e o do próprio
-- colaborador leem daqui). Escrita não tem política: o INSERT é revogado de
-- `authenticated` logo abaixo e só acontece via SECURITY DEFINER, mesmo
-- padrão de `apontamentos` desde 20260722020000. Medição que o usuário
-- pudesse escrever à mão não seria medição.
create policy produtividade_execucoes_select on public.produtividade_execucoes
  for select to authenticated using ((select auth.uid()) is not null);

grant select on public.produtividade_execucoes to authenticated;
revoke insert, update, delete on public.produtividade_execucoes from authenticated;

commit;

begin;

-- ---------------------------------------------------------------------
-- 4. Resumo por demanda — base da sugestão de virada para tempo fixo
--
-- security_invoker: sem isto a view roda com o privilégio do dono e fura a
-- RLS de quem consulta (é o que 0002_fix_rls_views_grants.sql corrigiu nas
-- views antigas).
--
-- Sem recorte de data de propósito: quem usa esta view é a sugestão de
-- tempo fixo, que quer o histórico inteiro da demanda. O painel de
-- produtividade filtra por período consultando a tabela direto.
-- ---------------------------------------------------------------------
create or replace view public.demandas_produtividade_resumo
with (security_invoker = true) as
select
  e.demanda_id,
  e.area_id,
  e.organizacao_id,
  count(*)::int                          as execucoes,
  sum(e.tempo_esperado_min)::int         as esperado_total_min,
  sum(e.tempo_real_min)::int             as real_total_min,
  round(avg(e.tempo_real_min))::int      as media_real_min,
  min(e.tempo_real_min)::int             as min_real_min,
  max(e.tempo_real_min)::int             as max_real_min,
  max(e.data)                            as ultima_execucao
from public.produtividade_execucoes e
group by e.demanda_id, e.area_id, e.organizacao_id;

revoke all on public.demandas_produtividade_resumo from anon;
grant select on public.demandas_produtividade_resumo to authenticated;

-- A produtividade agregada é esperado_total / real_total — soma sobre soma,
-- nunca média de razões. Uma execução de 2 min contra padrão de 60 tem razão
-- 30 e sequestraria qualquer média aritmética; ponderar pelo tempo resolve
-- isso sem precisar descartar outlier na mão. A divisão fica em
-- lib/produtividade.ts, que é testável.

commit;

begin;

-- ---------------------------------------------------------------------
-- 5. Esperado de uma demanda, em minutos
--
-- Um lugar só para a regra, porque ela é consultada de dois pontos de
-- entrega (apontamento e cartão) e divergir entre eles produziria demandas
-- com produtividade calculada em réguas diferentes.
--
-- STABLE + security invoker: lê `demandas` e `complexidade_niveis` com o
-- privilégio de quem chama. Chamada de dentro de função SECURITY DEFINER,
-- herda o contexto dela — que é o desejado, já que a definer já validou a
-- organização antes de chegar aqui.
-- ---------------------------------------------------------------------
create or replace function public.demanda_tempo_esperado_min(
  p_demanda_id uuid,
  p_quantidade numeric
) returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_demanda record;
  v_ref integer;
begin
  select variavel, tempo_padrao_min, blocos_totais, complexidade, organizacao_id
  into v_demanda
  from demandas where id = p_demanda_id;

  if v_demanda is null or p_quantidade is null or p_quantidade <= 0 then
    return null;
  end if;

  if v_demanda.variavel then
    -- Variável sem complexidade declarada não é medível: não existe
    -- esperado contra o qual comparar, e chutar um seria pior que não medir.
    if v_demanda.complexidade is null then
      return null;
    end if;
    select minutos_referencia into v_ref
    from complexidade_niveis
    where organizacao_id = v_demanda.organizacao_id and nivel = v_demanda.complexidade;
    if v_ref is null then
      return null;
    end if;
    return greatest(1, round(v_ref * p_quantidade)::int);
  end if;

  if v_demanda.tempo_padrao_min is null then
    return null;
  end if;

  -- Mesma conta de apontamentos_calculado: em demanda dividida em blocos,
  -- quantidade é o nº de blocos e tempo_padrao_min é o total dos blocos.
  return greatest(
    1,
    round(v_demanda.tempo_padrao_min * p_quantidade
          / greatest(coalesce(v_demanda.blocos_totais, 1), 1))::int
  );
end;
$$;

revoke all on function public.demanda_tempo_esperado_min(uuid, numeric) from public, anon;
grant execute on function public.demanda_tempo_esperado_min(uuid, numeric) to authenticated;

commit;

begin;

-- ---------------------------------------------------------------------
-- 6. registrar_apontamento ganha p_tempo_gasto_min
--
-- DROP antes do CREATE, e não `create or replace`: a aridade mudou, e
-- `create or replace` com número diferente de argumentos cria uma SOBRECARGA
-- em vez de substituir. As duas passariam a existir, e a chamada de 5
-- argumentos ficaria ambígua — erro que só aparece em runtime, na hora do
-- lançamento.
-- ---------------------------------------------------------------------
drop function if exists public.registrar_apontamento(uuid, numeric, integer, text, text);

create function public.registrar_apontamento(
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text,
  p_tempo_gasto_min integer default null
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colaborador_id uuid := auth.uid();
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_acumulado numeric;
  v_row apontamentos;
  v_organizacao_id uuid;
  v_esperado integer;
  v_real integer;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min, organizacao_id into v_carga_horaria_min, v_organizacao_id
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  -- p_demanda_id vem de fora: sem o filtro, um id de outra organização
  -- criaria apontamento vinculado a uma demanda que não é a sua.
  select variavel, tempo_padrao_min, blocos_totais, ativo, finita, area_id
  into v_demanda
  from demandas
  where id = p_demanda_id and organizacao_id = v_organizacao_id;

  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  -- Tempo gasto é opcional, mas quando informado precisa ser plausível: a
  -- mesma trava de carga que já existe para tempo manual. Cronômetro
  -- esquecido a noite toda não pode virar 14h de "tempo real" e destruir a
  -- produtividade da demanda para todo mundo.
  if p_tempo_gasto_min is not null then
    if p_tempo_gasto_min <= 0 then
      raise exception 'TEMPO_GASTO_INVALIDO';
    end if;
    if p_tempo_gasto_min > v_carga_horaria_min then
      raise exception 'TEMPO_EXCEDE_CARGA';
    end if;
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
    v_colaborador_id, p_demanda_id, p_quantidade, p_tempo_manual_min, v_motivo, p_observacoes,
    current_date,
    case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
    case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end,
    v_organizacao_id
  )
  returning * into v_row;

  -- Medição de produtividade, quando ela é possível.
  --
  -- Demanda variável já traz o tempo real: `tempo_manual_min` É o que a
  -- pessoa gastou, por definição. Ela passa a medir produtividade sem
  -- nenhum campo novo na tela — basta o gestor ter declarado a
  -- complexidade. Demanda de tempo padrão depende do campo opcional.
  v_real := case when v_demanda.variavel then p_tempo_manual_min else p_tempo_gasto_min end;
  if v_real is not null and v_real > 0 then
    v_esperado := demanda_tempo_esperado_min(p_demanda_id, p_quantidade);
    if v_esperado is not null and v_esperado > 0 then
      insert into produtividade_execucoes (
        organizacao_id, colaborador_id, demanda_id, area_id, origem,
        apontamento_id, data, quantidade, tempo_esperado_min, tempo_real_min
      ) values (
        v_organizacao_id, v_colaborador_id, p_demanda_id, v_demanda.area_id, 'apontamento',
        v_row.id, v_row.data, p_quantidade, v_esperado, v_real
      );
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.registrar_apontamento(uuid, numeric, integer, text, text, integer) from public, anon;
grant execute on function public.registrar_apontamento(uuid, numeric, integer, text, text, integer) to authenticated;

commit;

begin;

-- ---------------------------------------------------------------------
-- 6b. Editar o apontamento tem que mexer na medição junto
--
-- `atualizar_apontamento` altera demanda, quantidade e tempo manual da linha
-- no lugar. Sem tratar a medição aqui, corrigir "3 blocos" para "1 bloco"
-- deixaria uma produtividade calculada contra o esperado de 3 — errada, e
-- errada em silêncio, que é o pior tipo.
--
-- O tempo REAL é preservado em vez de recalculado: em demanda de tempo
-- padrão ele só existe dentro de produtividade_execucoes (não há coluna em
-- `apontamentos` para ele), então recalcular do zero perderia o dado que a
-- pessoa informou. Em demanda variável o tempo real É o tempo manual, e o
-- novo valor vale.
--
-- Nenhum parâmetro novo: a tela de edição não pede tempo gasto, e pedir
-- ali obrigaria quem só quer corrigir a quantidade a redigitar o tempo.
-- ---------------------------------------------------------------------
create or replace function public.atualizar_apontamento(
  p_id uuid,
  p_demanda_id uuid,
  p_quantidade numeric,
  p_tempo_manual_min integer,
  p_motivo text,
  p_observacoes text
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colaborador_id uuid := auth.uid();
  v_carga_horaria_min integer;
  v_demanda record;
  v_motivo text := p_motivo;
  v_acumulado numeric;
  v_row apontamentos;
  v_organizacao_id uuid;
  v_real_anterior integer;
  v_real integer;
  v_esperado integer;
begin
  if v_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select carga_horaria_min, organizacao_id into v_carga_horaria_min, v_organizacao_id
  from colaboradores
  where id = v_colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  -- p_demanda_id vem de fora: sem o filtro de organização, um id de outra
  -- empresa passaria pela checagem de "demanda existe e está ativa" e o
  -- apontamento seria reatribuído a uma demanda que não é da mesma organização.
  select variavel, tempo_padrao_min, blocos_totais, ativo, finita, area_id
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
      where demanda_id = p_demanda_id and id <> p_id;

      if v_acumulado + p_quantidade > v_demanda.blocos_totais then
        raise exception 'BLOCOS_FINITOS_ESGOTADOS';
      end if;
    end if;
  end if;

  select tempo_real_min into v_real_anterior
  from produtividade_execucoes where apontamento_id = p_id;

  update apontamentos
  set demanda_id = p_demanda_id,
      quantidade = p_quantidade,
      tempo_manual_min = p_tempo_manual_min,
      motivo = v_motivo,
      observacoes = p_observacoes,
      tempo_padrao_snapshot = case when v_demanda.variavel then null else v_demanda.tempo_padrao_min end,
      blocos_totais_snapshot = case when v_demanda.variavel then 1 else greatest(coalesce(v_demanda.blocos_totais, 1), 1) end
  where id = p_id
    and colaborador_id = v_colaborador_id
    and data = current_date
    and organizacao_id = (select public.org_atual())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'APONTAMENTO_NAO_ENCONTRADO';
  end if;

  v_real := case when v_demanda.variavel then p_tempo_manual_min else v_real_anterior end;
  v_esperado := demanda_tempo_esperado_min(p_demanda_id, p_quantidade);

  if v_real is null or v_real <= 0 or v_esperado is null or v_esperado <= 0 then
    -- Deixou de ser medível (mudou para uma demanda variável sem
    -- complexidade, por exemplo). Apagar é mais honesto que manter a
    -- medição antiga vinculada a um lançamento que não existe mais assim.
    delete from produtividade_execucoes where apontamento_id = p_id;
  else
    insert into produtividade_execucoes (
      organizacao_id, colaborador_id, demanda_id, area_id, origem,
      apontamento_id, data, quantidade, tempo_esperado_min, tempo_real_min
    ) values (
      v_organizacao_id, v_row.colaborador_id, p_demanda_id, v_demanda.area_id, 'apontamento',
      v_row.id, v_row.data, p_quantidade, v_esperado, v_real
    )
    on conflict (apontamento_id) where apontamento_id is not null do update set
      demanda_id = excluded.demanda_id,
      area_id = excluded.area_id,
      quantidade = excluded.quantidade,
      tempo_esperado_min = excluded.tempo_esperado_min,
      tempo_real_min = excluded.tempo_real_min;
  end if;

  return v_row;
end;
$$;

revoke all on function public.atualizar_apontamento(uuid, uuid, numeric, integer, text, text) from public, anon;
grant execute on function public.atualizar_apontamento(uuid, uuid, numeric, integer, text, text) to authenticated;

commit;

begin;

-- ---------------------------------------------------------------------
-- 7. Entrega no Kanban vira medição
--
-- AFTER, não BEFORE: `cartoes_aplicar_entrega` (20260730100000) é BEFORE e
-- só ajusta a própria linha; aqui precisamos somar sessões e escrever em
-- outra tabela, com a linha do cartão já gravada.
--
-- SECURITY DEFINER porque INSERT em produtividade_execucoes é revogado de
-- `authenticated`. A organização NÃO vem de entrada do usuário: vem de
-- NEW.organizacao_id, a própria linha que acabou de ser atualizada e que já
-- passou pela política do eixo de `cartoes`. Ainda assim a demanda é
-- reconferida contra essa organização — `cartoes.demanda_id` não tem FK
-- composta (é nulo em cartão sem demanda), então estruturalmente nada
-- impede hoje que aponte para demanda de outra organização.
-- ---------------------------------------------------------------------
create or replace function public.cartoes_medir_produtividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_real integer;
  v_esperado integer;
  v_colaborador uuid;
  v_area uuid;
begin
  if new.demanda_id is null then
    return null;
  end if;

  select area_id into v_area
  from demandas
  where id = new.demanda_id and organizacao_id = new.organizacao_id;

  if v_area is null then
    return null;
  end if;

  -- Tempo real do cartão é a soma das sessões de cronômetro. Cartão
  -- entregue sem nenhuma sessão não é medível — e não medir é a resposta
  -- certa, porque a alternativa seria inventar um tempo.
  select coalesce(sum(minutos), 0)::int into v_real
  from cartoes_sessoes_tempo
  where cartao_id = new.id and finalizado_em is not null;

  if v_real is null or v_real <= 0 then
    return null;
  end if;

  -- Quem cronometrou mais é de quem é a execução. Cartão tocado por várias
  -- pessoas atribui a medição a uma só, de propósito: dividir o esperado
  -- entre elas mediria colaboração, não velocidade de execução.
  select colaborador_id into v_colaborador
  from cartoes_sessoes_tempo
  where cartao_id = new.id and finalizado_em is not null
  group by colaborador_id
  order by sum(minutos) desc nulls last
  limit 1;

  if v_colaborador is null then
    return null;
  end if;

  -- O cartão representa uma execução inteira da demanda, então quantidade
  -- 1 e o tempo padrão cheio (não fatiado por blocos). `tempo_estimado_min`
  -- do próprio cartão existe, mas não é usado aqui de propósito: misturar
  -- estimativa por cartão com padrão da demanda faria a produtividade
  -- agregada por demanda somar réguas diferentes.
  v_esperado := demanda_tempo_esperado_min(new.demanda_id, 1);
  if v_esperado is null or v_esperado <= 0 then
    return null;
  end if;

  insert into produtividade_execucoes (
    organizacao_id, colaborador_id, demanda_id, area_id, origem,
    cartao_id, data, quantidade, tempo_esperado_min, tempo_real_min
  ) values (
    new.organizacao_id, v_colaborador, new.demanda_id, v_area, 'cartao',
    new.id, new.entregue_em::date, 1, v_esperado, v_real
  )
  on conflict (cartao_id) where cartao_id is not null do update set
    colaborador_id = excluded.colaborador_id,
    demanda_id = excluded.demanda_id,
    area_id = excluded.area_id,
    data = excluded.data,
    tempo_esperado_min = excluded.tempo_esperado_min,
    tempo_real_min = excluded.tempo_real_min,
    criado_em = now();

  return null;
end;
$$;

drop trigger if exists trg_cartoes_medir_produtividade on public.cartoes;
-- Só na transição para entregue. Sem o WHEN, toda edição de cartão entregue
-- recalcularia a medição — inclusive depois de a demanda ter sido
-- recalibrada, reescrevendo o passado.
--
-- `after update` sem `of entregue_em`: a coluna NÃO aparece no SET da
-- aplicação, ela é preenchida pelo BEFORE trigger cartoes_aplicar_entrega a
-- partir da coluna de destino. `update of entregue_em` dispara pelas
-- colunas MENCIONADAS no comando, não pelas que mudaram — então filtrar por
-- coluna aqui faria o trigger nunca rodar. O WHEN de um AFTER trigger vê a
-- linha final, já com o que o BEFORE escreveu, e é ele que faz o recorte.
create trigger trg_cartoes_medir_produtividade
  after update on public.cartoes
  for each row
  when (old.entregue_em is null and new.entregue_em is not null)
  execute function public.cartoes_medir_produtividade();

commit;

begin;

-- ---------------------------------------------------------------------
-- 8. Complexidade atravessa o fluxo de sugestão
--
-- Sem isto, o colaborador sugere uma demanda variável com complexidade
-- "alta", o gestor aprova, e a demanda nasce sem complexidade nenhuma —
-- silenciosamente fora da produtividade.
-- ---------------------------------------------------------------------
create or replace function public.aprovar_solicitacao(p_id uuid)
returns solicitacoes_demandas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitacoes_demandas;
  v_tempo_padrao_min integer;
  v_blocos_totais integer;
  v_finita boolean;
  v_complexidade text;
  v_gestor_ativo boolean;
begin
  select ativo into v_gestor_ativo
  from colaboradores
  where id = auth.uid() and role = 'gestor';

  if v_gestor_ativo is not true then
    raise exception 'NAO_AUTORIZADO';
  end if;

  update solicitacoes_demandas
  set status = 'APROVADA', atualizado_em = now()
  where id = p_id and status = 'PENDENTE'
    and organizacao_id = (select public.org_atual())
  returning * into v_sol;

  if v_sol.id is null then
    raise exception 'SOLICITACAO_NAO_ENCONTRADA';
  end if;

  if v_sol.variavel then
    v_tempo_padrao_min := null;
    v_blocos_totais := 1;
    v_finita := false;
    v_complexidade := v_sol.complexidade;
  else
    v_tempo_padrao_min := v_sol.tempo_padrao_min;
    v_blocos_totais := greatest(coalesce(v_sol.blocos_totais, 1), 1);
    v_finita := coalesce(v_sol.finita, false);
    -- Complexidade só existe em demanda variável: em demanda de tempo
    -- padrão o esperado é o próprio tempo padrão.
    v_complexidade := null;
    if v_blocos_totais > 1 and v_tempo_padrao_min is null then
      raise exception 'DEMANDA_BLOCOS_SEM_TEMPO';
    end if;
    if v_finita and v_blocos_totais <= 1 then
      raise exception 'DEMANDA_FINITA_SEM_BLOCOS';
    end if;
  end if;

  if v_sol.tipo = 'NOVA' then
    insert into demandas (area_id, nome, tempo_padrao_min, variavel, blocos_totais, finita, complexidade, ativo, organizacao_id)
    values (v_sol.area_id, v_sol.nome, v_tempo_padrao_min, v_sol.variavel, v_blocos_totais, v_finita, v_complexidade, true, v_sol.organizacao_id);
  elsif v_sol.tipo = 'ALTERACAO' then
    if v_sol.demanda_id is null then
      raise exception 'ALTERACAO_SEM_DEMANDA';
    end if;
    update demandas
    set nome = v_sol.nome,
        tempo_padrao_min = v_tempo_padrao_min,
        variavel = v_sol.variavel,
        blocos_totais = v_blocos_totais,
        finita = v_finita,
        complexidade = v_complexidade,
        ativo = coalesce(v_sol.ativo, true)
    where id = v_sol.demanda_id and organizacao_id = v_sol.organizacao_id;
  end if;

  if exists (
    select 1 from colaboradores
    where id = v_sol.colaborador_id and notif_solicitacoes = true
  ) then
    insert into notificacoes (destinatario_id, tipo, titulo, mensagem, link, organizacao_id)
    values (
      v_sol.colaborador_id, 'solicitacao_aprovada', 'Solicitação aprovada',
      'Sua sugestão "' || v_sol.nome || '" foi aprovada.', '/catalogo?tab=solicitacoes', v_sol.organizacao_id
    );
  end if;

  return v_sol;
exception
  when unique_violation then
    raise exception 'NOME_DUPLICADO';
end;
$$;

revoke all on function public.aprovar_solicitacao(uuid) from public, anon;
grant execute on function public.aprovar_solicitacao(uuid) to authenticated;

commit;

begin;

-- ---------------------------------------------------------------------
-- 9. Organização nova nasce com a régua de complexidade
--
-- Sem isto, o primeiro gestor de um cliente novo marca "alta complexidade"
-- numa demanda e nada acontece — `demanda_tempo_esperado_min` não acha o
-- nível e devolve null, sem erro nenhum para explicar por quê.
-- ---------------------------------------------------------------------
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

  insert into public.complexidade_niveis (organizacao_id, nivel, minutos_referencia)
  values (v_org_id, 'baixa', 15), (v_org_id, 'media', 30),
         (v_org_id, 'alta', 60), (v_org_id, 'muito_alta', 120);

  -- role='gestor' + admin=true: quem cadastra a organização é o primeiro
  -- admin dela (a constraint colaboradores_admin_exige_gestor exige que
  -- admin implique gestor). O trigger trg_colaboradores_assentos roda neste
  -- insert (ativo=true) e confere 1 <= limite_assentos do plano trial.
  insert into public.colaboradores (id, nome, area_id, role, admin, ativo, organizacao_id)
  values (p_user_id, trim(p_nome_gestor), v_area_id, 'gestor', true, true, v_org_id);

  return v_org_id;
end;
$$;

revoke all on function public.criar_organizacao(uuid, text, text) from public, anon, authenticated;

commit;
