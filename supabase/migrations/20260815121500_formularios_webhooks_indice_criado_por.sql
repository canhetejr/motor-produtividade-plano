-- get_advisors (performance) apontou formularios_webhooks_criado_por_fkey sem
-- índice de cobertura logo após a migration anterior — mesma razão dos outros
-- índices do eixo (skill vertice-isolamento regra 3): sem ele, filtrar por
-- criado_por vira seq scan conforme a tabela cresce.
create index if not exists idx_formularios_webhooks_criado_por on public.formularios_webhooks (criado_por);
