-- Motor de automações do quadro ("quando X acontecer, faça Y, Z, W") +
-- os dois dados que faltavam pro card e pros eventos de SLA.
--
-- Aqui só mora o ESTADO das automações. A execução fica na aplicação
-- (lib/automacoes.ts), diferente das regras de movimentação do bloco 29, que
-- foram pra trigger. O critério é o tipo de garantia: bloquear movimentação é
-- integridade e não pode ter caminho de fuga; automação é conveniência — e
-- ações como "enviar e-mail" (SMTP via nodemailer) não rodam dentro do
-- Postgres de qualquer forma.

begin;

-- `etapa_desde` alimenta duas coisas: "Tempo decorrido na etapa" na sidebar
-- do card e os eventos de SLA. `sla_horas` é o teto por etapa (null = sem SLA).
alter table cartoes add column if not exists etapa_desde timestamptz;
alter table colunas add column if not exists sla_horas integer
  check (sla_horas is null or sla_horas > 0);

-- Cards que já existem nunca passaram pelo trigger com a coluna nova: sem
-- backfill mostrariam "tempo na etapa" vazio pra sempre.
update cartoes set etapa_desde = coalesce(updated_at, created_at) where etapa_desde is null;

commit;

begin;

create table if not exists automacoes (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid references quadros(id) on delete cascade not null,
  nome text not null,
  ativa boolean not null default true,
  posicao integer not null default 0,
  evento text not null,
  -- Filtro do evento: { colunaId } pra "entrar na etapa X", { etiquetaId }
  -- pra "tag adicionada", { horasAntes } pra "perto de atrasar"...
  evento_config jsonb not null default '{}'::jsonb,
  criado_por uuid references colaboradores(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automacoes_quadro_idx on automacoes (quadro_id, posicao);
create index if not exists automacoes_evento_idx on automacoes (quadro_id, evento) where ativa = true;

create table if not exists automacoes_acoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid references automacoes(id) on delete cascade not null,
  ordem integer not null,
  tipo text not null,
  config jsonb not null default '{}'::jsonb
);

create index if not exists automacoes_acoes_automacao_idx on automacoes_acoes (automacao_id, ordem);

-- Log de execução: sustenta os badges de contagem da tela ("7 ATIVAS,
-- 0 COM ERRO") e o total de ações executadas. `status = 'cortado'` é a trava
-- anti-loop tendo agido — precisa ser visível, senão o gestor só vê a
-- automação "não rodando" sem entender por quê.
create table if not exists automacoes_execucoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid references automacoes(id) on delete cascade not null,
  cartao_id uuid references cartoes(id) on delete set null,
  status text not null check (status in ('ok', 'erro', 'cortado')),
  erro text,
  acoes_executadas integer not null default 0,
  executado_em timestamptz not null default now()
);

create index if not exists automacoes_execucoes_automacao_idx
  on automacoes_execucoes (automacao_id, executado_em desc);

commit;

begin;

alter table automacoes enable row level security;
alter table automacoes_acoes enable row level security;
alter table automacoes_execucoes enable row level security;

drop policy if exists "automacoes_all_membro" on automacoes;
create policy "automacoes_all_membro" on automacoes for all
  using (is_quadro_membro(quadro_id))
  with check (is_quadro_membro(quadro_id));

drop policy if exists "automacoes_acoes_all_membro" on automacoes_acoes;
create policy "automacoes_acoes_all_membro" on automacoes_acoes for all
  using (exists (select 1 from automacoes a where a.id = automacoes_acoes.automacao_id and is_quadro_membro(a.quadro_id)))
  with check (exists (select 1 from automacoes a where a.id = automacoes_acoes.automacao_id and is_quadro_membro(a.quadro_id)));

-- Insert liberado pro membro porque quem grava o log é o dispatcher rodando
-- com o client da sessão de quem disparou o evento (o cron usa service role e
-- ignora RLS). Update/delete não têm policy: log não se edita.
drop policy if exists "automacoes_execucoes_select_membro" on automacoes_execucoes;
create policy "automacoes_execucoes_select_membro" on automacoes_execucoes for select
  using (exists (select 1 from automacoes a where a.id = automacoes_execucoes.automacao_id and is_quadro_membro(a.quadro_id)));

drop policy if exists "automacoes_execucoes_insert_membro" on automacoes_execucoes;
create policy "automacoes_execucoes_insert_membro" on automacoes_execucoes for insert
  with check (exists (select 1 from automacoes a where a.id = automacoes_execucoes.automacao_id and is_quadro_membro(a.quadro_id)));

revoke all on automacoes, automacoes_acoes, automacoes_execucoes from anon;

commit;

-- ---------------------------------------------------------------------
-- Trigger de movimentação do bloco 29 recriado para também carimbar
-- `etapa_desde`. É o mesmo ponto onde a entrega já é aplicada — ter um
-- segundo trigger só pra isso duplicaria a mesma condição de mudança de
-- coluna.
-- ---------------------------------------------------------------------

begin;

create or replace function public.cartoes_aplicar_entrega()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_destino_final boolean;
  v_tipo text;
begin
  -- Só reage a entrada/saída de coluna. Update que não mexe em coluna_id
  -- (renomear, trocar prioridade) passa reto.
  if tg_op = 'UPDATE' and new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  new.etapa_desde := now();

  select etapa_final into v_destino_final from colunas where id = new.coluna_id;

  if coalesce(v_destino_final, false) then
    -- Reentrar numa etapa final não reescreve a data da primeira entrega.
    if new.entregue_em is null then
      new.entregue_em := now();
    end if;

    -- Casts explícitos pra date: `current_date + interval` devolve timestamp,
    -- e depender do cast de atribuição pra chegar em date é sutil demais.
    v_tipo := new.recorrencia->>'tipo';
    if v_tipo is not null then
      new.proxima_recorrencia_em := case v_tipo
        when 'diaria' then (current_date + 1)::date
        when 'semanal' then (current_date + 7)::date
        when 'mensal' then (current_date + interval '1 month')::date
      end;
    end if;
  else
    -- Saiu da etapa final: o card voltou pro fluxo, então deixa de estar
    -- entregue e a recorrência agendada perde o sentido.
    new.entregue_em := null;
    new.proxima_recorrencia_em := null;
  end if;

  return new;
end;
$$;

commit;
