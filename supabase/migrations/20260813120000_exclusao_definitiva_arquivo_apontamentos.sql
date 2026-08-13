-- Exclusão definitiva de demanda e de colaborador, com arquivamento dos
-- apontamentos.
--
-- Até aqui o produto só sabia inativar (`ativo = false`). O efeito prático é
-- uma lista de catálogo e de equipe que só cresce: quem saiu da empresa e a
-- demanda que nunca mais vai ser lançada continuam ocupando espaço na tela
-- para sempre. O pedido é excluir de verdade — mas apontamento é a matéria
-- prima do índice de produtividade, e apagar histórico junto com o cadastro
-- falsificaria relatório já fechado.
--
-- A saída é arquivar: o apontamento sai da tabela viva (some do cálculo, some
-- das telas do dia a dia) e entra em apontamentos_arquivados como retrato
-- desnormalizado — com o nome da pessoa, da demanda e da área congelados em
-- texto, já que as linhas de origem deixam de existir.

-- === 1. Arquivo de apontamentos ===

create table if not exists public.apontamentos_arquivados (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  apontamento_id uuid not null,
  -- Sem FK de propósito nos dois ids abaixo: a linha de origem foi excluída,
  -- e é justamente por isso que este registro existe. Ficam como rastro para
  -- cruzar com auditoria, não como referência navegável.
  colaborador_id uuid,
  colaborador_nome text not null,
  demanda_id uuid,
  demanda_nome text not null,
  area_nome text,
  data date not null,
  quantidade numeric not null,
  tempo_manual_min integer,
  tempo_padrao_snapshot integer,
  blocos_totais_snapshot integer not null default 1,
  observacoes text,
  motivo text,
  criado_em timestamptz not null,
  arquivado_em timestamptz not null default now(),
  arquivado_por uuid,
  -- 'demanda_excluida' | 'colaborador_excluido'
  arquivado_motivo text not null
);

-- A política do eixo filtra por organizacao_id em toda leitura; sem o índice
-- isolado a tela de arquivo vira seq scan à medida que a tabela cresce (ela
-- só cresce — nada aqui é apagado no uso normal).
create index if not exists apontamentos_arquivados_org_idx
  on public.apontamentos_arquivados (organizacao_id, data desc);

alter table public.apontamentos_arquivados enable row level security;

drop policy if exists apontamentos_arquivados_org on public.apontamentos_arquivados;
create policy apontamentos_arquivados_org on public.apontamentos_arquivados
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

drop policy if exists apontamentos_arquivados_select_gestor on public.apontamentos_arquivados;
create policy apontamentos_arquivados_select_gestor on public.apontamentos_arquivados
  for select
  using ((select public.auth_role()) = 'gestor');

-- Escrita só pelas funções de exclusão abaixo (security definer). Não há
-- caminho de UI que insira aqui, e um insert manual pela API seria um jeito
-- de forjar histórico.
revoke all on public.apontamentos_arquivados from anon, authenticated;
grant select on public.apontamentos_arquivados to authenticated;

-- === 2. Autoria sobrevive a quem escreveu ===
--
-- Comentário, anexo, quadro, formulário e trilha de auditoria são conteúdo da
-- empresa, não da pessoa: excluir quem escreveu não pode apagar o que foi
-- escrito. As colunas de autoria viram anuláveis e ganham, onde a interface
-- mostra o autor, um retrato do nome no momento da exclusão.
--
-- As FKs continuam MATCH SIMPLE — com a coluna nula a checagem composta
-- simplesmente não se aplica, que é o comportamento desejado aqui.

alter table public.auditoria alter column ator_id drop not null;
alter table public.auditoria add column if not exists ator_nome text;

alter table public.comentarios_cartao alter column colaborador_id drop not null;
alter table public.comentarios_cartao add column if not exists autor_nome text;

alter table public.cartoes_anexos alter column colaborador_id drop not null;
alter table public.cartoes_anexos add column if not exists autor_nome text;

alter table public.cartoes_aprovacoes alter column aprovador_id drop not null;
alter table public.cartoes_aprovacoes alter column solicitado_por drop not null;

alter table public.formularios alter column criado_por drop not null;
alter table public.quadros alter column criado_por drop not null;

-- === 3. Excluir demanda ===

create or replace function public.excluir_demanda_definitiva(p_demanda_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ator uuid := auth.uid();
  v_demanda public.demandas%rowtype;
  v_area_nome text;
  v_arquivados integer := 0;
begin
  -- Roda como owner: RLS não protege nada aqui dentro. Organização e papel
  -- são checados à mão, ou a função vira caminho de exclusão cross-tenant.
  v_org := public.org_atual();
  if v_org is null then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if public.auth_role() is distinct from 'gestor' then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select * into v_demanda from public.demandas where id = p_demanda_id for update;
  if not found or v_demanda.organizacao_id is distinct from v_org then
    raise exception 'DEMANDA_NAO_ENCONTRADA';
  end if;

  select a.nome into v_area_nome from public.areas a where a.id = v_demanda.area_id;

  insert into public.apontamentos_arquivados (
    organizacao_id, apontamento_id, colaborador_id, colaborador_nome,
    demanda_id, demanda_nome, area_nome, data, quantidade, tempo_manual_min,
    tempo_padrao_snapshot, blocos_totais_snapshot, observacoes, motivo,
    criado_em, arquivado_por, arquivado_motivo
  )
  select
    ap.organizacao_id, ap.id, ap.colaborador_id, coalesce(c.nome, 'Colaborador removido'),
    ap.demanda_id, v_demanda.nome, v_area_nome, ap.data, ap.quantidade, ap.tempo_manual_min,
    ap.tempo_padrao_snapshot, ap.blocos_totais_snapshot, ap.observacoes, ap.motivo,
    ap.created_at, v_ator, 'demanda_excluida'
  from public.apontamentos ap
  left join public.colaboradores c on c.id = ap.colaborador_id
  where ap.demanda_id = p_demanda_id and ap.organizacao_id = v_org;

  get diagnostics v_arquivados = row_count;

  delete from public.apontamentos where demanda_id = p_demanda_id and organizacao_id = v_org;
  -- Correção pendente de uma demanda que deixou de existir não tem como ser
  -- decidida; o dado que interessava já foi para o arquivo pelo apontamento.
  delete from public.apontamentos_correcoes where demanda_id = p_demanda_id and organizacao_id = v_org;

  -- Cartão continua existindo: ele é trabalho em andamento no Kanban, e o
  -- vínculo com a demanda é opcional por definição.
  update public.cartoes set demanda_id = null where demanda_id = p_demanda_id and organizacao_id = v_org;
  update public.solicitacoes_demandas set demanda_id = null
    where demanda_id = p_demanda_id and organizacao_id = v_org;

  delete from public.demandas where id = p_demanda_id and organizacao_id = v_org;

  return v_arquivados;
end;
$$;

revoke all on function public.excluir_demanda_definitiva(uuid) from public, anon;
grant execute on function public.excluir_demanda_definitiva(uuid) to authenticated;

-- === 4. Excluir colaborador ===

create or replace function public.excluir_colaborador_definitivo(p_colaborador_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ator uuid := auth.uid();
  v_alvo public.colaboradores%rowtype;
  v_ator_admin boolean;
  v_arquivados integer := 0;
begin
  v_org := public.org_atual();
  if v_org is null then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select admin into v_ator_admin from public.colaboradores
   where id = v_ator and organizacao_id = v_org and ativo = true;
  -- Excluir alguém apaga acesso e dado pessoal de uma vez: é poder de admin,
  -- pela mesma separação de privilégio que já vale para redefinir senha.
  if not coalesce(v_ator_admin, false) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select * into v_alvo from public.colaboradores where id = p_colaborador_id for update;
  if not found or v_alvo.organizacao_id is distinct from v_org then
    raise exception 'COLABORADOR_NAO_ENCONTRADO';
  end if;
  if p_colaborador_id = v_ator then
    raise exception 'NAO_PODE_EXCLUIR_A_SI';
  end if;
  -- O dono responde pela conta da empresa; a FK de organizacoes até anularia
  -- o vínculo em silêncio, e é justamente isso que não pode acontecer.
  if exists (select 1 from public.organizacoes o
              where o.id = v_org and o.dono_colaborador_id = p_colaborador_id) then
    raise exception 'NAO_PODE_EXCLUIR_DONO';
  end if;

  -- O trigger trg_colaboradores_proteger_admin só cobre UPDATE. Sem esta
  -- checagem, excluir o último admin deixaria a empresa sem ninguém capaz de
  -- redefinir senha ou gerir acesso — e sem caminho de volta pela própria UI.
  if v_alvo.admin and (
    select count(*) from public.colaboradores
     where organizacao_id = v_org and admin = true and id <> p_colaborador_id
  ) = 0 then
    raise exception 'ULTIMO_ADMIN';
  end if;

  insert into public.apontamentos_arquivados (
    organizacao_id, apontamento_id, colaborador_id, colaborador_nome,
    demanda_id, demanda_nome, area_nome, data, quantidade, tempo_manual_min,
    tempo_padrao_snapshot, blocos_totais_snapshot, observacoes, motivo,
    criado_em, arquivado_por, arquivado_motivo
  )
  select
    ap.organizacao_id, ap.id, ap.colaborador_id, v_alvo.nome,
    ap.demanda_id, coalesce(d.nome, 'Demanda removida'), ar.nome, ap.data, ap.quantidade,
    ap.tempo_manual_min, ap.tempo_padrao_snapshot, ap.blocos_totais_snapshot,
    ap.observacoes, ap.motivo, ap.created_at, v_ator, 'colaborador_excluido'
  from public.apontamentos ap
  left join public.demandas d on d.id = ap.demanda_id
  left join public.areas ar on ar.id = d.area_id
  where ap.colaborador_id = p_colaborador_id and ap.organizacao_id = v_org;

  get diagnostics v_arquivados = row_count;

  -- Autoria: o conteúdo fica, o vínculo com a pessoa some, o nome vira texto.
  update public.auditoria set ator_nome = coalesce(ator_nome, v_alvo.nome), ator_id = null
    where ator_id = p_colaborador_id;
  update public.comentarios_cartao set autor_nome = coalesce(autor_nome, v_alvo.nome), colaborador_id = null
    where colaborador_id = p_colaborador_id;
  update public.cartoes_anexos set autor_nome = coalesce(autor_nome, v_alvo.nome), colaborador_id = null
    where colaborador_id = p_colaborador_id;
  update public.cartoes_aprovacoes set aprovador_id = null where aprovador_id = p_colaborador_id;
  update public.cartoes_aprovacoes set solicitado_por = null where solicitado_por = p_colaborador_id;
  update public.formularios set criado_por = null where criado_por = p_colaborador_id;
  update public.quadros set criado_por = null where criado_por = p_colaborador_id;
  update public.quadros_compartilhamentos set criado_por = null where criado_por = p_colaborador_id;
  update public.cartoes set criado_por = null where criado_por = p_colaborador_id;
  update public.cartoes_dependencias set criado_por = null where criado_por = p_colaborador_id;
  update public.cartoes_templates set criado_por = null where criado_por = p_colaborador_id;
  update public.automacoes set criado_por = null where criado_por = p_colaborador_id;
  update public.metas set criado_por = null where criado_por = p_colaborador_id;
  update public.relatorios_agendados set criado_por = null where criado_por = p_colaborador_id;
  update public.apontamentos_correcoes set decidido_por = null where decidido_por = p_colaborador_id;

  -- Dado pessoal e de sessão: sai junto com a pessoa, sem retrato nenhum.
  delete from public.apontamentos where colaborador_id = p_colaborador_id;
  delete from public.apontamentos_correcoes where colaborador_id = p_colaborador_id;
  delete from public.solicitacoes_demandas where colaborador_id = p_colaborador_id;
  delete from public.notificacoes where destinatario_id = p_colaborador_id;
  delete from public.push_inscricoes where colaborador_id = p_colaborador_id;
  delete from public.desafios_mfa where colaborador_id = p_colaborador_id;
  delete from public.mcp_tokens where colaborador_id = p_colaborador_id;
  delete from public.google_workspace_conexoes where colaborador_id = p_colaborador_id;
  delete from public.cartoes_emails where colaborador_id = p_colaborador_id;
  delete from public.cartoes_sessoes_tempo where colaborador_id = p_colaborador_id;
  delete from public.cartoes_sequencia_responsaveis where colaborador_id = p_colaborador_id;
  delete from public.metas where colaborador_id = p_colaborador_id;

  -- O resto (cartoes_responsaveis, cartoes_seguidores, quadros_membros,
  -- google_calendar_eventos, relatorios_agendados_destinatarios) já sai por
  -- ON DELETE CASCADE na linha abaixo.
  delete from public.colaboradores where id = p_colaborador_id and organizacao_id = v_org;

  return v_arquivados;
end;
$$;

revoke all on function public.excluir_colaborador_definitivo(uuid) from public, anon;
grant execute on function public.excluir_colaborador_definitivo(uuid) to authenticated;
