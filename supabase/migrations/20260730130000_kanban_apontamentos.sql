-- O tempo do Kanban passa a contar no índice de produtividade.
--
-- Problema: `indicadores_diarios` (índice, dashboard, /relatorios, crons de
-- alerta-queda e relatorio-semanal) lê só de `apontamentos_calculado`. O
-- cronômetro do card gravava em `cartoes_sessoes_tempo`, que não alimenta
-- nada disso. Quem cronometrava 3h num card ganhava zero de índice e ainda
-- precisava lançar o mesmo trabalho à mão em /apontamento.
--
-- Aqui a sessão de cronômetro vira apontamento de verdade, na demanda que o
-- card aponta.
--
-- Nota que evita uma pergunta futura: NÃO é preciso mexer em
-- `apontamentos_calculado`. Ela decide usar tempo manual por
-- `tempo_manual_min is not null`, não por `demandas.variavel` — então
-- cronômetro em demanda padrão (com blocos) já calcula certo gravando
-- tempo_manual_min e blocos_totais_snapshot = 1.

begin;

-- Nullable de propósito: já existem cards sem demanda, e travar a coluna
-- quebraria o quadro. Obrigatório só no formulário de criação; card sem
-- demanda simplesmente não gera apontamento (e a UI avisa).
alter table cartoes add column if not exists demanda_id uuid references demandas(id);
create index if not exists cartoes_demanda_idx on cartoes (demanda_id) where demanda_id is not null;

-- O vínculo mora no apontamento, não na sessão, porque a cardinalidade é
-- 1:N: sessão que cruza a meia-noite vira UM apontamento por dia. Um
-- `apontamento_id` único na sessão só conseguiria apontar para o primeiro.
--
-- `on delete cascade`: apagar a sessão apaga os apontamentos que ela gerou,
-- senão o índice ficaria contando tempo de uma sessão que não existe mais.
-- O cascade roda no nível do sistema e não esbarra na policy de delete de
-- apontamentos (que só permite o dia corrente) — que é o desejado aqui.
alter table apontamentos add column if not exists cartao_sessao_id uuid
  references cartoes_sessoes_tempo(id) on delete cascade;
create index if not exists apontamentos_cartao_sessao_idx
  on apontamentos (cartao_sessao_id) where cartao_sessao_id is not null;

-- Correção da policy do bloco 28: `ajustarHorasRegistradas` e
-- `excluirSessaoTempo` permitem que o GESTOR registre/apague sessão de outra
-- pessoa, mas a policy original exigia `colaborador_id = auth.uid()` — a
-- action de gestor falhava silenciosamente no RLS.
drop policy if exists "cartoes_sessoes_tempo_write_own" on cartoes_sessoes_tempo;
create policy "cartoes_sessoes_tempo_write_own" on cartoes_sessoes_tempo for all
  using (colaborador_id = auth.uid() or auth_role() = 'gestor')
  with check (
    (colaborador_id = auth.uid() or auth_role() = 'gestor')
    and exists (
      select 1 from cartoes c
      join colunas col on col.id = c.coluna_id
      where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id)
    )
  );

commit;

begin;

-- ---------------------------------------------------------------------
-- RPC: transforma uma fatia de sessão de cronômetro em apontamento.
--
-- Espelha `registrar_apontamento` (blocos 13/18) no que importa — SECURITY
-- DEFINER porque INSERT direto em `apontamentos` é revogado de
-- `authenticated` — e diverge em dois pontos, de propósito:
--
--   1. Aceita `p_data`. A trava "só lança hoje" (RLS + RPC original) existe
--      para impedir que alguém DIGITE tempo retroativo inventado. Sessão de
--      cronômetro tem timestamps reais, então lançar no dia em que o trabalho
--      de fato aconteceu é mais honesto, não menos. O gate é ter uma sessão
--      fechada de verdade, não a data.
--   2. Não exige `motivo`. O motivo do lançamento é o card, cujo código vai
--      em `observacoes`.
--
-- Quem fatia sessão que cruza a meia-noite é `fatiarSessaoPorDia`
-- (lib/tempo.ts), em TypeScript, para poder ser testado — esta função recebe
-- uma fatia já pronta.
-- ---------------------------------------------------------------------

create or replace function public.registrar_apontamento_timer(
  p_sessao_id uuid,
  p_data date,
  p_minutos integer
) returns apontamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessao cartoes_sessoes_tempo;
  v_demanda_id uuid;
  v_codigo text;
  v_titulo text;
  v_demanda record;
  v_carga_horaria_min integer;
  v_row apontamentos;
begin
  select * into v_sessao from cartoes_sessoes_tempo where id = p_sessao_id;

  if v_sessao.id is null then
    raise exception 'SESSAO_NAO_ENCONTRADA';
  end if;

  -- O dono da sessão lança o próprio tempo; o gestor também, porque
  -- `ajustarHorasRegistradas` permite a ele corrigir horas de outra pessoa.
  if v_sessao.colaborador_id <> auth.uid() and auth_role() <> 'gestor' then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if v_sessao.finalizado_em is null then
    raise exception 'SESSAO_ABERTA';
  end if;

  -- Idempotência por (sessão, dia): pausar/despausar em sequência não lança
  -- duas vezes, e sessão que cruza a meia-noite ainda consegue lançar a fatia
  -- do segundo dia.
  if exists (
    select 1 from apontamentos
    where cartao_sessao_id = p_sessao_id and data = p_data
  ) then
    return null;
  end if;

  if p_minutos is null or p_minutos <= 0 then
    return null;
  end if;

  select c.demanda_id, c.codigo, c.titulo into v_demanda_id, v_codigo, v_titulo
  from cartoes c where c.id = v_sessao.cartao_id;

  -- Card sem demanda não vira apontamento. Não é erro: é um card que a pessoa
  -- ainda não ligou ao catálogo, e a UI avisa isso no widget de tempo.
  if v_demanda_id is null then
    return null;
  end if;

  select variavel, tempo_padrao_min, ativo into v_demanda from demandas where id = v_demanda_id;
  if v_demanda is null or v_demanda.ativo is not true then
    raise exception 'DEMANDA_INATIVA';
  end if;

  select carga_horaria_min into v_carga_horaria_min
  from colaboradores where id = v_sessao.colaborador_id and ativo = true;

  if v_carga_horaria_min is null then
    raise exception 'CONTA_INATIVA';
  end if;

  -- Mesma trava de `registrar_apontamento`: cronômetro esquecido a noite toda
  -- geraria 14h num dia e destruiria o índice. A pessoa lança o tempo real
  -- pelo ajuste manual.
  if p_minutos > v_carga_horaria_min then
    raise exception 'TEMPO_EXCEDE_CARGA';
  end if;

  insert into apontamentos (
    colaborador_id, demanda_id, data, quantidade, tempo_manual_min, motivo, observacoes,
    tempo_padrao_snapshot, blocos_totais_snapshot, cartao_sessao_id
  ) values (
    v_sessao.colaborador_id, v_demanda_id, p_data, 1, p_minutos, null,
    'Kanban ' || coalesce(v_codigo, '') || ' · ' || coalesce(v_titulo, ''),
    null, 1, p_sessao_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.registrar_apontamento_timer(uuid, date, integer) from public;
grant execute on function public.registrar_apontamento_timer(uuid, date, integer) to authenticated;

commit;
