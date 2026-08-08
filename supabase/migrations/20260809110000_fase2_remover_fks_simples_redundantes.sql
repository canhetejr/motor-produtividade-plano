-- Achado pós-Fase-2: cada FK composta nova (*_org) coexistia com a FK
-- simples original na mesma coluna, e as duas apontam para o mesmo pai.
-- Isso não é redundância inofensiva — o PostgREST vê dois caminhos de
-- relacionamento entre a mesma dupla de tabelas e recusa embed implícito
-- (`select *, colaboradores(nome)`) com "more than one relationship was
-- found", exigindo hint de coluna. Apareceu primeiro como erro de tipo em
-- app/(app)/gestao/auditoria/page.tsx depois de regenerar
-- lib/database.types.ts — teria quebrado em runtime, não só no build.
--
-- A correção é remover a FK simples superada: a composta
-- (coluna, organizacao_id) → pai(id, organizacao_id) já garante tudo que a
-- simples garantia (coluna existe no pai) e mais (na mesma organização).
-- Não é perda de integridade, é a mesma verificação sem a ambiguidade.
--
-- Onde uma tabela tinha DUAS FKs para o mesmo pai por colunas diferentes
-- (ex.: cartoes_dependencias.cartao_id e .depende_de_id, ambas → cartoes),
-- só a que ganhou composta nesta leva é removida — a outra continua como
-- estava, single-path, sem ambiguidade nova.

alter table public.apontamentos drop constraint apontamentos_colaborador_id_fkey;
alter table public.apontamentos_correcoes drop constraint apontamentos_correcoes_colaborador_id_fkey;
alter table public.auditoria drop constraint auditoria_ator_id_fkey;
alter table public.automacoes drop constraint automacoes_quadro_id_fkey;
alter table public.colunas drop constraint colunas_quadro_id_fkey;
alter table public.desafios_mfa drop constraint desafios_mfa_colaborador_id_fkey;
alter table public.etiquetas drop constraint etiquetas_quadro_id_fkey;
alter table public.google_workspace_conexoes drop constraint google_workspace_conexoes_colaborador_id_fkey;
alter table public.notificacoes drop constraint notificacoes_destinatario_id_fkey;
alter table public.push_inscricoes drop constraint push_inscricoes_colaborador_id_fkey;
alter table public.quadros_membros drop constraint quadros_membros_quadro_id_fkey;
alter table public.solicitacoes_demandas drop constraint solicitacoes_demandas_area_id_fkey;
alter table public.quadros_compartilhamentos drop constraint quadros_compartilhamentos_quadro_id_fkey;
alter table public.quadros_campos drop constraint quadros_campos_quadro_id_fkey;
alter table public.cartoes_templates drop constraint cartoes_templates_quadro_id_fkey;
alter table public.formularios drop constraint formularios_quadro_id_fkey;
alter table public.metas drop constraint metas_colaborador_id_fkey;
alter table public.relatorios_agendados drop constraint relatorios_agendados_criado_por_fkey;
alter table public.cartoes drop constraint cartoes_coluna_id_fkey;
alter table public.colunas_requisitos drop constraint colunas_requisitos_coluna_id_fkey;
alter table public.automacoes_acoes drop constraint automacoes_acoes_automacao_id_fkey;
alter table public.automacoes_execucoes drop constraint automacoes_execucoes_automacao_id_fkey;
alter table public.formularios_campos drop constraint formularios_campos_formulario_id_fkey;
alter table public.relatorios_agendados_destinatarios drop constraint relatorios_agendados_destinatarios_relatorio_id_fkey;
alter table public.cartoes_anexos drop constraint cartoes_anexos_cartao_id_fkey;
alter table public.cartoes_aprovacoes drop constraint cartoes_aprovacoes_cartao_id_fkey;
alter table public.cartoes_checklist_itens drop constraint cartoes_checklist_itens_cartao_id_fkey;
alter table public.cartoes_dependencias drop constraint cartoes_dependencias_cartao_id_fkey;
alter table public.cartoes_emails drop constraint cartoes_emails_cartao_id_fkey;
alter table public.cartoes_etiquetas drop constraint cartoes_etiquetas_cartao_id_fkey;
alter table public.cartoes_predecessores drop constraint cartoes_predecessores_cartao_id_fkey;
alter table public.cartoes_requisitos_status drop constraint cartoes_requisitos_status_cartao_id_fkey;
alter table public.cartoes_responsaveis drop constraint cartoes_responsaveis_cartao_id_fkey;
alter table public.cartoes_seguidores drop constraint cartoes_seguidores_cartao_id_fkey;
alter table public.cartoes_sequencia_responsaveis drop constraint cartoes_sequencia_responsaveis_cartao_id_fkey;
alter table public.cartoes_sessoes_tempo drop constraint cartoes_sessoes_tempo_cartao_id_fkey;
alter table public.comentarios_cartao drop constraint comentarios_cartao_cartao_id_fkey;
alter table public.google_calendar_eventos drop constraint google_calendar_eventos_cartao_id_fkey;
alter table public.cartoes_campos_valores drop constraint cartoes_campos_valores_cartao_id_fkey;
