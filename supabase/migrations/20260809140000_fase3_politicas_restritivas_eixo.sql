-- Fase 3 de docs/PLANO-PRODUTO.md: uma política RESTRICTIVE por tabela de
-- negócio (as 43 já com organizacao_id, Fases 1 e 2), sobrepondo — não
-- substituindo — as políticas de papel que já existem (is_quadro_membro,
-- auth_role() = 'gestor', colaborador_id = auth.uid()).
--
-- RESTRICTIVE, não permissiva: as políticas de papel existentes são
-- permissivas e combinam com OR entre si. Se o eixo entrasse como mais uma
-- permissiva, `is_quadro_membro(...) OR organizacao_id = org_atual()`
-- ampliaria o acesso em vez de restringir — o inverso do que se quer.
-- Restritiva combina com AND sobre todas as permissivas: "além de tudo o
-- que já era exigido, também tem que ser da minha organização".
--
-- (select public.org_atual()) em subconsulta para hoisting de InitPlan —
-- sem isso a função roda uma vez por linha, o mesmo problema que
-- 20260802130000_rls_initplan_e_metas.sql já corrigiu para outras funções.
--
-- `for all` numa política só: o eixo é a mesma pergunta para
-- select/insert/update/delete, não quatro perguntas diferentes.
--
-- Verificado antes de aplicar: nenhuma política hoje concede acesso ao
-- papel `anon` em nenhuma destas 43 tabelas (só `planos`, fora do eixo,
-- tem policy para anon) — então nenhum caminho anônimo existente é afetado
-- por org_atual() devolver NULL para quem não está autenticado.
--
-- A migration 20260809130000 deu DEFAULT à organização nº 1 nestas mesmas
-- 43 colunas, então INSERT do app ainda não atualizado para a Fase 4
-- continua caindo do lado certo do WITH CHECK abaixo.

create policy "apontamentos_org" on public.apontamentos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "apontamentos_correcoes_org" on public.apontamentos_correcoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "areas_org" on public.areas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "auditoria_org" on public.auditoria
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "automacoes_org" on public.automacoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "automacoes_acoes_org" on public.automacoes_acoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "automacoes_execucoes_org" on public.automacoes_execucoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_org" on public.cartoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_anexos_org" on public.cartoes_anexos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_aprovacoes_org" on public.cartoes_aprovacoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_campos_valores_org" on public.cartoes_campos_valores
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_checklist_itens_org" on public.cartoes_checklist_itens
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_dependencias_org" on public.cartoes_dependencias
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_emails_org" on public.cartoes_emails
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_etiquetas_org" on public.cartoes_etiquetas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_predecessores_org" on public.cartoes_predecessores
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_requisitos_status_org" on public.cartoes_requisitos_status
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_responsaveis_org" on public.cartoes_responsaveis
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_seguidores_org" on public.cartoes_seguidores
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_sequencia_responsaveis_org" on public.cartoes_sequencia_responsaveis
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_sessoes_tempo_org" on public.cartoes_sessoes_tempo
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "cartoes_templates_org" on public.cartoes_templates
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "colaboradores_org" on public.colaboradores
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "colunas_org" on public.colunas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "colunas_requisitos_org" on public.colunas_requisitos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "comentarios_cartao_org" on public.comentarios_cartao
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "demandas_org" on public.demandas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "desafios_mfa_org" on public.desafios_mfa
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "etiquetas_org" on public.etiquetas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "formularios_org" on public.formularios
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "formularios_campos_org" on public.formularios_campos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "google_calendar_eventos_org" on public.google_calendar_eventos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "google_workspace_conexoes_org" on public.google_workspace_conexoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "metas_org" on public.metas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "notificacoes_org" on public.notificacoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "push_inscricoes_org" on public.push_inscricoes
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "quadros_org" on public.quadros
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "quadros_campos_org" on public.quadros_campos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "quadros_compartilhamentos_org" on public.quadros_compartilhamentos
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "quadros_membros_org" on public.quadros_membros
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "relatorios_agendados_org" on public.relatorios_agendados
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "relatorios_agendados_destinatarios_org" on public.relatorios_agendados_destinatarios
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));

create policy "solicitacoes_demandas_org" on public.solicitacoes_demandas
  as restrictive for all
  using (organizacao_id = (select public.org_atual()))
  with check (organizacao_id = (select public.org_atual()));
