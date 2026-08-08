-- Fase 2 de docs/PLANO-PRODUTO.md: organizacao_id nas 39 tabelas restantes,
-- com FK composta contra o pai que já tem o eixo (Fase 1: areas,
-- colaboradores, quadros, demandas). Nenhuma política RLS é tocada aqui —
-- isso é a Fase 3.
--
-- As 39 têm dependência entre si (cartoes depende de colunas, que depende
-- de quadros; os filhos de cartao dependem de cartoes) — por isso a
-- migration é organizada em 3 níveis, cada um só usando pais que já
-- ganharam organizacao_id NOT NULL nos níveis anteriores desta mesma
-- transação. Levantado contra o grafo real de FKs do banco em 09/08/2026,
-- não por suposição.
--
-- DDL (alter table, create index) fica como statement de topo, fora de
-- blocos `do $$`: misturar DDL com DML dentro de PL/pgSQL na mesma tabela
-- arrisca cache de plano/catálogo desatualizado entre as duas — foi
-- exatamente esse tipo de problema que quebrou a primeira tentativa da
-- Fase 1 (org_atual() validada contra uma coluna que ainda não existia).
-- `do $$` é usado só para a verificação de linha órfã, como na Fase 1.
--
-- Duas tabelas (metas, relatorios_agendados) não têm nenhuma FK NOT NULL —
-- backfill por literal (uma organização só existe hoje) e a FK composta
-- usa MATCH SIMPLE (padrão) sobre a coluna mais provável de estar
-- preenchida; linhas com essa coluna nula não são validadas pela FK, mas
-- organizacao_id continua NOT NULL de qualquer forma.

-- ============================================================
-- NÍVEL A — pai é uma das 4 raízes (areas/colaboradores/quadros/demandas)
-- ============================================================

alter table public.apontamentos add column organizacao_id uuid references public.organizacoes(id);
alter table public.apontamentos_correcoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.auditoria add column organizacao_id uuid references public.organizacoes(id);
alter table public.automacoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.colunas add column organizacao_id uuid references public.organizacoes(id);
alter table public.desafios_mfa add column organizacao_id uuid references public.organizacoes(id);
alter table public.etiquetas add column organizacao_id uuid references public.organizacoes(id);
alter table public.google_workspace_conexoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.notificacoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.push_inscricoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.quadros_membros add column organizacao_id uuid references public.organizacoes(id);
alter table public.solicitacoes_demandas add column organizacao_id uuid references public.organizacoes(id);
alter table public.quadros_compartilhamentos add column organizacao_id uuid references public.organizacoes(id);
alter table public.quadros_campos add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_templates add column organizacao_id uuid references public.organizacoes(id);
alter table public.formularios add column organizacao_id uuid references public.organizacoes(id);
alter table public.metas add column organizacao_id uuid references public.organizacoes(id);
alter table public.relatorios_agendados add column organizacao_id uuid references public.organizacoes(id);

update public.apontamentos a set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = a.colaborador_id;
update public.apontamentos_correcoes t set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = t.colaborador_id;
update public.auditoria t set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = t.ator_id;
update public.automacoes t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
update public.colunas t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
update public.desafios_mfa t set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = t.colaborador_id;
update public.etiquetas t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
update public.google_workspace_conexoes t set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = t.colaborador_id;
update public.notificacoes t set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = t.destinatario_id;
update public.push_inscricoes t set organizacao_id = c.organizacao_id from public.colaboradores c where c.id = t.colaborador_id;
update public.quadros_membros t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
update public.solicitacoes_demandas t set organizacao_id = a.organizacao_id from public.areas a where a.id = t.area_id;
update public.quadros_compartilhamentos t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
update public.quadros_campos t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
-- cartoes_templates e formularios usam quadro_id direto (não via cartoes/
-- colunas) de propósito: assim não dependem do Nível B.
update public.cartoes_templates t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
update public.formularios t set organizacao_id = q.organizacao_id from public.quadros q where q.id = t.quadro_id;
-- metas e relatorios_agendados não têm FK NOT NULL nenhuma: literal.
update public.metas set organizacao_id = '00000000-0000-0000-0000-000000000001';
update public.relatorios_agendados set organizacao_id = '00000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (select 1 from public.apontamentos where organizacao_id is null) then raise exception 'apontamentos com organizacao_id nula'; end if;
  if exists (select 1 from public.apontamentos_correcoes where organizacao_id is null) then raise exception 'apontamentos_correcoes com organizacao_id nula'; end if;
  if exists (select 1 from public.auditoria where organizacao_id is null) then raise exception 'auditoria com organizacao_id nula'; end if;
  if exists (select 1 from public.automacoes where organizacao_id is null) then raise exception 'automacoes com organizacao_id nula'; end if;
  if exists (select 1 from public.colunas where organizacao_id is null) then raise exception 'colunas com organizacao_id nula'; end if;
  if exists (select 1 from public.desafios_mfa where organizacao_id is null) then raise exception 'desafios_mfa com organizacao_id nula'; end if;
  if exists (select 1 from public.etiquetas where organizacao_id is null) then raise exception 'etiquetas com organizacao_id nula'; end if;
  if exists (select 1 from public.google_workspace_conexoes where organizacao_id is null) then raise exception 'google_workspace_conexoes com organizacao_id nula'; end if;
  if exists (select 1 from public.notificacoes where organizacao_id is null) then raise exception 'notificacoes com organizacao_id nula'; end if;
  if exists (select 1 from public.push_inscricoes where organizacao_id is null) then raise exception 'push_inscricoes com organizacao_id nula'; end if;
  if exists (select 1 from public.quadros_membros where organizacao_id is null) then raise exception 'quadros_membros com organizacao_id nula'; end if;
  if exists (select 1 from public.solicitacoes_demandas where organizacao_id is null) then raise exception 'solicitacoes_demandas com organizacao_id nula'; end if;
  if exists (select 1 from public.quadros_compartilhamentos where organizacao_id is null) then raise exception 'quadros_compartilhamentos com organizacao_id nula'; end if;
  if exists (select 1 from public.quadros_campos where organizacao_id is null) then raise exception 'quadros_campos com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_templates where organizacao_id is null) then raise exception 'cartoes_templates com organizacao_id nula'; end if;
  if exists (select 1 from public.formularios where organizacao_id is null) then raise exception 'formularios com organizacao_id nula'; end if;
  if exists (select 1 from public.metas where organizacao_id is null) then raise exception 'metas com organizacao_id nula'; end if;
  if exists (select 1 from public.relatorios_agendados where organizacao_id is null) then raise exception 'relatorios_agendados com organizacao_id nula'; end if;
end $$;

alter table public.apontamentos alter column organizacao_id set not null;
alter table public.apontamentos_correcoes alter column organizacao_id set not null;
alter table public.auditoria alter column organizacao_id set not null;
alter table public.automacoes alter column organizacao_id set not null;
alter table public.colunas alter column organizacao_id set not null;
alter table public.desafios_mfa alter column organizacao_id set not null;
alter table public.etiquetas alter column organizacao_id set not null;
alter table public.google_workspace_conexoes alter column organizacao_id set not null;
alter table public.notificacoes alter column organizacao_id set not null;
alter table public.push_inscricoes alter column organizacao_id set not null;
alter table public.quadros_membros alter column organizacao_id set not null;
alter table public.solicitacoes_demandas alter column organizacao_id set not null;
alter table public.quadros_compartilhamentos alter column organizacao_id set not null;
alter table public.quadros_campos alter column organizacao_id set not null;
alter table public.cartoes_templates alter column organizacao_id set not null;
alter table public.formularios alter column organizacao_id set not null;
alter table public.metas alter column organizacao_id set not null;
alter table public.relatorios_agendados alter column organizacao_id set not null;

-- unique(id, organizacao_id) só nas 4 do Nível A que servem de pai no
-- Nível B (automacoes, colunas, formularios, relatorios_agendados). As
-- outras 14 não são referenciadas compositamente por ninguém nesta leva.
alter table public.automacoes add constraint automacoes_id_org unique (id, organizacao_id);
alter table public.colunas add constraint colunas_id_org unique (id, organizacao_id);
alter table public.formularios add constraint formularios_id_org unique (id, organizacao_id);
alter table public.relatorios_agendados add constraint relatorios_agendados_id_org unique (id, organizacao_id);

alter table public.apontamentos add constraint apontamentos_colaborador_org foreign key (colaborador_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.apontamentos_correcoes add constraint apontamentos_correcoes_colaborador_org foreign key (colaborador_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.auditoria add constraint auditoria_ator_org foreign key (ator_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.automacoes add constraint automacoes_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.colunas add constraint colunas_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.desafios_mfa add constraint desafios_mfa_colaborador_org foreign key (colaborador_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.etiquetas add constraint etiquetas_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.google_workspace_conexoes add constraint google_workspace_conexoes_colaborador_org foreign key (colaborador_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.notificacoes add constraint notificacoes_destinatario_org foreign key (destinatario_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.push_inscricoes add constraint push_inscricoes_colaborador_org foreign key (colaborador_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.quadros_membros add constraint quadros_membros_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.solicitacoes_demandas add constraint solicitacoes_demandas_area_org foreign key (area_id, organizacao_id) references public.areas (id, organizacao_id);
alter table public.quadros_compartilhamentos add constraint quadros_compartilhamentos_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.quadros_campos add constraint quadros_campos_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.cartoes_templates add constraint cartoes_templates_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
alter table public.formularios add constraint formularios_quadro_org foreign key (quadro_id, organizacao_id) references public.quadros (id, organizacao_id);
-- metas.colaborador_id e relatorios_agendados.criado_por são nuláveis:
-- MATCH SIMPLE (padrão) não valida a FK quando a coluna referenciada é
-- nula, então linha sem colaborador/autor não quebra a constraint.
alter table public.metas add constraint metas_colaborador_org foreign key (colaborador_id, organizacao_id) references public.colaboradores (id, organizacao_id);
alter table public.relatorios_agendados add constraint relatorios_agendados_criado_por_org foreign key (criado_por, organizacao_id) references public.colaboradores (id, organizacao_id);

create index on public.apontamentos (organizacao_id);
create index on public.apontamentos_correcoes (organizacao_id);
create index on public.auditoria (organizacao_id);
create index on public.automacoes (organizacao_id);
create index on public.colunas (organizacao_id);
create index on public.desafios_mfa (organizacao_id);
create index on public.etiquetas (organizacao_id);
create index on public.google_workspace_conexoes (organizacao_id);
create index on public.notificacoes (organizacao_id);
create index on public.push_inscricoes (organizacao_id);
create index on public.quadros_membros (organizacao_id);
create index on public.solicitacoes_demandas (organizacao_id);
create index on public.quadros_compartilhamentos (organizacao_id);
create index on public.quadros_campos (organizacao_id);
create index on public.cartoes_templates (organizacao_id);
create index on public.formularios (organizacao_id);
create index on public.metas (organizacao_id);
create index on public.relatorios_agendados (organizacao_id);

-- ============================================================
-- NÍVEL B — pai é uma tabela do Nível A (colunas/automacoes/formularios/
-- relatorios_agendados), já com organizacao_id NOT NULL acima
-- ============================================================

alter table public.cartoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.colunas_requisitos add column organizacao_id uuid references public.organizacoes(id);
alter table public.automacoes_acoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.automacoes_execucoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.formularios_campos add column organizacao_id uuid references public.organizacoes(id);
alter table public.relatorios_agendados_destinatarios add column organizacao_id uuid references public.organizacoes(id);

-- cartoes.coluna_id é NOT NULL: é a FK usada para o backfill e a FK
-- composta, em vez de demanda_id/centro_id/criado_por (todos nuláveis).
update public.cartoes t set organizacao_id = c.organizacao_id from public.colunas c where c.id = t.coluna_id;
update public.colunas_requisitos t set organizacao_id = c.organizacao_id from public.colunas c where c.id = t.coluna_id;
update public.automacoes_acoes t set organizacao_id = a.organizacao_id from public.automacoes a where a.id = t.automacao_id;
update public.automacoes_execucoes t set organizacao_id = a.organizacao_id from public.automacoes a where a.id = t.automacao_id;
update public.formularios_campos t set organizacao_id = f.organizacao_id from public.formularios f where f.id = t.formulario_id;
update public.relatorios_agendados_destinatarios t set organizacao_id = r.organizacao_id from public.relatorios_agendados r where r.id = t.relatorio_id;

do $$
begin
  if exists (select 1 from public.cartoes where organizacao_id is null) then raise exception 'cartoes com organizacao_id nula'; end if;
  if exists (select 1 from public.colunas_requisitos where organizacao_id is null) then raise exception 'colunas_requisitos com organizacao_id nula'; end if;
  if exists (select 1 from public.automacoes_acoes where organizacao_id is null) then raise exception 'automacoes_acoes com organizacao_id nula'; end if;
  if exists (select 1 from public.automacoes_execucoes where organizacao_id is null) then raise exception 'automacoes_execucoes com organizacao_id nula'; end if;
  if exists (select 1 from public.formularios_campos where organizacao_id is null) then raise exception 'formularios_campos com organizacao_id nula'; end if;
  if exists (select 1 from public.relatorios_agendados_destinatarios where organizacao_id is null) then raise exception 'relatorios_agendados_destinatarios com organizacao_id nula'; end if;
end $$;

alter table public.cartoes alter column organizacao_id set not null;
alter table public.colunas_requisitos alter column organizacao_id set not null;
alter table public.automacoes_acoes alter column organizacao_id set not null;
alter table public.automacoes_execucoes alter column organizacao_id set not null;
alter table public.formularios_campos alter column organizacao_id set not null;
alter table public.relatorios_agendados_destinatarios alter column organizacao_id set not null;

-- unique(id, organizacao_id) só em cartoes: é pai de 14 tabelas do Nível C.
alter table public.cartoes add constraint cartoes_id_org unique (id, organizacao_id);

alter table public.cartoes add constraint cartoes_coluna_org foreign key (coluna_id, organizacao_id) references public.colunas (id, organizacao_id);
alter table public.colunas_requisitos add constraint colunas_requisitos_coluna_org foreign key (coluna_id, organizacao_id) references public.colunas (id, organizacao_id);
alter table public.automacoes_acoes add constraint automacoes_acoes_automacao_org foreign key (automacao_id, organizacao_id) references public.automacoes (id, organizacao_id);
alter table public.automacoes_execucoes add constraint automacoes_execucoes_automacao_org foreign key (automacao_id, organizacao_id) references public.automacoes (id, organizacao_id);
alter table public.formularios_campos add constraint formularios_campos_formulario_org foreign key (formulario_id, organizacao_id) references public.formularios (id, organizacao_id);
alter table public.relatorios_agendados_destinatarios add constraint relatorios_agendados_destinatarios_relatorio_org foreign key (relatorio_id, organizacao_id) references public.relatorios_agendados (id, organizacao_id);

create index on public.cartoes (organizacao_id);
create index on public.colunas_requisitos (organizacao_id);
create index on public.automacoes_acoes (organizacao_id);
create index on public.automacoes_execucoes (organizacao_id);
create index on public.formularios_campos (organizacao_id);
create index on public.relatorios_agendados_destinatarios (organizacao_id);

-- ============================================================
-- NÍVEL C — pai é cartoes (Nível B, já com organizacao_id NOT NULL acima)
-- ============================================================

alter table public.cartoes_anexos add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_aprovacoes add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_checklist_itens add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_dependencias add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_emails add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_etiquetas add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_predecessores add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_requisitos_status add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_responsaveis add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_seguidores add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_sequencia_responsaveis add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_sessoes_tempo add column organizacao_id uuid references public.organizacoes(id);
alter table public.comentarios_cartao add column organizacao_id uuid references public.organizacoes(id);
alter table public.google_calendar_eventos add column organizacao_id uuid references public.organizacoes(id);
alter table public.cartoes_campos_valores add column organizacao_id uuid references public.organizacoes(id);

update public.cartoes_anexos t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_aprovacoes t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_checklist_itens t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_dependencias t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_emails t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_etiquetas t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_predecessores t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_requisitos_status t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_responsaveis t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_seguidores t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_sequencia_responsaveis t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_sessoes_tempo t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.comentarios_cartao t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.google_calendar_eventos t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;
update public.cartoes_campos_valores t set organizacao_id = c.organizacao_id from public.cartoes c where c.id = t.cartao_id;

do $$
begin
  if exists (select 1 from public.cartoes_anexos where organizacao_id is null) then raise exception 'cartoes_anexos com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_aprovacoes where organizacao_id is null) then raise exception 'cartoes_aprovacoes com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_checklist_itens where organizacao_id is null) then raise exception 'cartoes_checklist_itens com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_dependencias where organizacao_id is null) then raise exception 'cartoes_dependencias com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_emails where organizacao_id is null) then raise exception 'cartoes_emails com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_etiquetas where organizacao_id is null) then raise exception 'cartoes_etiquetas com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_predecessores where organizacao_id is null) then raise exception 'cartoes_predecessores com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_requisitos_status where organizacao_id is null) then raise exception 'cartoes_requisitos_status com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_responsaveis where organizacao_id is null) then raise exception 'cartoes_responsaveis com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_seguidores where organizacao_id is null) then raise exception 'cartoes_seguidores com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_sequencia_responsaveis where organizacao_id is null) then raise exception 'cartoes_sequencia_responsaveis com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_sessoes_tempo where organizacao_id is null) then raise exception 'cartoes_sessoes_tempo com organizacao_id nula'; end if;
  if exists (select 1 from public.comentarios_cartao where organizacao_id is null) then raise exception 'comentarios_cartao com organizacao_id nula'; end if;
  if exists (select 1 from public.google_calendar_eventos where organizacao_id is null) then raise exception 'google_calendar_eventos com organizacao_id nula'; end if;
  if exists (select 1 from public.cartoes_campos_valores where organizacao_id is null) then raise exception 'cartoes_campos_valores com organizacao_id nula'; end if;
end $$;

alter table public.cartoes_anexos alter column organizacao_id set not null;
alter table public.cartoes_aprovacoes alter column organizacao_id set not null;
alter table public.cartoes_checklist_itens alter column organizacao_id set not null;
alter table public.cartoes_dependencias alter column organizacao_id set not null;
alter table public.cartoes_emails alter column organizacao_id set not null;
alter table public.cartoes_etiquetas alter column organizacao_id set not null;
alter table public.cartoes_predecessores alter column organizacao_id set not null;
alter table public.cartoes_requisitos_status alter column organizacao_id set not null;
alter table public.cartoes_responsaveis alter column organizacao_id set not null;
alter table public.cartoes_seguidores alter column organizacao_id set not null;
alter table public.cartoes_sequencia_responsaveis alter column organizacao_id set not null;
alter table public.cartoes_sessoes_tempo alter column organizacao_id set not null;
alter table public.comentarios_cartao alter column organizacao_id set not null;
alter table public.google_calendar_eventos alter column organizacao_id set not null;
alter table public.cartoes_campos_valores alter column organizacao_id set not null;

alter table public.cartoes_anexos add constraint cartoes_anexos_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_aprovacoes add constraint cartoes_aprovacoes_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_checklist_itens add constraint cartoes_checklist_itens_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_dependencias add constraint cartoes_dependencias_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_emails add constraint cartoes_emails_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_etiquetas add constraint cartoes_etiquetas_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_predecessores add constraint cartoes_predecessores_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_requisitos_status add constraint cartoes_requisitos_status_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_responsaveis add constraint cartoes_responsaveis_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_seguidores add constraint cartoes_seguidores_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_sequencia_responsaveis add constraint cartoes_sequencia_responsaveis_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_sessoes_tempo add constraint cartoes_sessoes_tempo_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.comentarios_cartao add constraint comentarios_cartao_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.google_calendar_eventos add constraint google_calendar_eventos_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);
alter table public.cartoes_campos_valores add constraint cartoes_campos_valores_cartao_org foreign key (cartao_id, organizacao_id) references public.cartoes (id, organizacao_id);

create index on public.cartoes_anexos (organizacao_id);
create index on public.cartoes_aprovacoes (organizacao_id);
create index on public.cartoes_checklist_itens (organizacao_id);
create index on public.cartoes_dependencias (organizacao_id);
create index on public.cartoes_emails (organizacao_id);
create index on public.cartoes_etiquetas (organizacao_id);
create index on public.cartoes_predecessores (organizacao_id);
create index on public.cartoes_requisitos_status (organizacao_id);
create index on public.cartoes_responsaveis (organizacao_id);
create index on public.cartoes_seguidores (organizacao_id);
create index on public.cartoes_sequencia_responsaveis (organizacao_id);
create index on public.cartoes_sessoes_tempo (organizacao_id);
create index on public.comentarios_cartao (organizacao_id);
create index on public.google_calendar_eventos (organizacao_id);
create index on public.cartoes_campos_valores (organizacao_id);
