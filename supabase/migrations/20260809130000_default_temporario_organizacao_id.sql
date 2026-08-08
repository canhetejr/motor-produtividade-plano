-- Rede de segurança temporária, não parte formal de nenhuma fase do plano.
--
-- Achado ao investigar antes da Fase 3: o banco de produção
-- (bapufbypqmtjtujfbiai) é o mesmo que o app publicado no Vercel (branch
-- master, código sem noção de organizacao_id) usa. Desde a Fase 2,
-- organizacao_id é NOT NULL em 43 tabelas — o app antigo, que nunca envia
-- essa coluna no INSERT, vai começar a falhar com violação de NOT NULL na
-- primeira tentativa de criar apontamento, cartão, comentário etc.
-- Verificado que ainda não aconteceu (get_runtime_errors do Vercel, 24h:
-- só um erro de refresh token, nada de banco; último apontamento é de
-- sexta-feira, hoje é sábado) — mas segunda de manhã quebraria em produção
-- para as 12 pessoas reais que usam o sistema.
--
-- Só existe uma organização hoje. Um DEFAULT para ela mantém o app antigo
-- funcionando exatamente como antes, até a Fase 4 (lib/auth.ts, as server
-- actions, os crons) ir ao ar sabendo popular a coluna de verdade.
--
-- Isto tem que ser removido depois da Fase 4/6/7: um DEFAULT que empurra
-- tudo para a organização 1 é inofensivo enquanto ela é a única, mas vira
-- um vazamento ativo no dia em que existir uma organização 2 e algum
-- INSERT novo esquecer o organizacao_id — a omissão que hoje cai no lugar
-- certo por acidente, nesse dia cai no lugar errado.

alter table public.apontamentos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.apontamentos_correcoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.areas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.auditoria alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.automacoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.automacoes_acoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.automacoes_execucoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_anexos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_aprovacoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_campos_valores alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_checklist_itens alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_dependencias alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_emails alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_etiquetas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_predecessores alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_requisitos_status alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_responsaveis alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_seguidores alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_sequencia_responsaveis alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_sessoes_tempo alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.cartoes_templates alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.colaboradores alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.colunas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.colunas_requisitos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.comentarios_cartao alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.demandas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.desafios_mfa alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.etiquetas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.formularios alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.formularios_campos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.google_calendar_eventos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.google_workspace_conexoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.metas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.notificacoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.push_inscricoes alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.quadros alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.quadros_campos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.quadros_compartilhamentos alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.quadros_membros alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.relatorios_agendados alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.relatorios_agendados_destinatarios alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
alter table public.solicitacoes_demandas alter column organizacao_id set default '00000000-0000-0000-0000-000000000001';
