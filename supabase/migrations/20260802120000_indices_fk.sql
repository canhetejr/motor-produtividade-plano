-- Indices de cobertura para as 24 FKs sem indice (advisor unindexed_foreign_keys).
-- Sem indice, toda checagem de integridade referencial e todo join por essa
-- coluna varre a tabela inteira. IF NOT EXISTS deixa a migration idempotente.

create index if not exists idx_auditoria_ator_id on public.auditoria (ator_id);
create index if not exists idx_automacoes_criado_por on public.automacoes (criado_por);
create index if not exists idx_automacoes_execucoes_cartao_id on public.automacoes_execucoes (cartao_id);
create index if not exists idx_cartoes_centro_id on public.cartoes (centro_id);
create index if not exists idx_cartoes_criado_por on public.cartoes (criado_por);
create index if not exists idx_cartoes_anexos_colaborador_id on public.cartoes_anexos (colaborador_id);
create index if not exists idx_cartoes_aprovacoes_aprovador_id on public.cartoes_aprovacoes (aprovador_id);
create index if not exists idx_cartoes_aprovacoes_solicitado_por on public.cartoes_aprovacoes (solicitado_por);
create index if not exists idx_cartoes_campos_valores_campo_id on public.cartoes_campos_valores (campo_id);
create index if not exists idx_cartoes_emails_colaborador_id on public.cartoes_emails (colaborador_id);
create index if not exists idx_cartoes_etiquetas_etiqueta_id on public.cartoes_etiquetas (etiqueta_id);
create index if not exists idx_cartoes_requisitos_status_requisito_id on public.cartoes_requisitos_status (requisito_id);
create index if not exists idx_cartoes_responsaveis_colaborador_id on public.cartoes_responsaveis (colaborador_id);
create index if not exists idx_cartoes_seguidores_colaborador_id on public.cartoes_seguidores (colaborador_id);
create index if not exists idx_cartoes_sequencia_responsaveis_colaborador_id on public.cartoes_sequencia_responsaveis (colaborador_id);
create index if not exists idx_colaboradores_area_id on public.colaboradores (area_id);
create index if not exists idx_comentarios_cartao_colaborador_id on public.comentarios_cartao (colaborador_id);
create index if not exists idx_formularios_coluna_id on public.formularios (coluna_id);
create index if not exists idx_formularios_criado_por on public.formularios (criado_por);
create index if not exists idx_quadros_criado_por on public.quadros (criado_por);
create index if not exists idx_quadros_membros_colaborador_id on public.quadros_membros (colaborador_id);
create index if not exists idx_solicitacoes_demandas_area_id on public.solicitacoes_demandas (area_id);
create index if not exists idx_solicitacoes_demandas_colaborador_id on public.solicitacoes_demandas (colaborador_id);
create index if not exists idx_solicitacoes_demandas_demanda_id on public.solicitacoes_demandas (demanda_id);

-- total: 24
