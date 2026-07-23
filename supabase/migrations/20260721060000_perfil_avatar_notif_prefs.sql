-- Tela de Perfil ganhou foto e preferencias de notificacao. Bucket "avatars"
-- publico (leitura sem auth via URL publica). O upload em si nunca passa
-- pelo client do browser, so por Server Action com o client admin
-- (SUPABASE_SERVICE_ROLE_KEY), entao nao precisa de policy de INSERT/UPDATE
-- em storage.objects: quem decide o path (sempre "{user_id}/avatar", travado
-- no id da sessao) e o codigo do servidor, nao uma policy de RLS.
--
-- notif_* controlam o que cada colaborador recebe: notif_lembrete_diario e
-- notif_alerta_queda/notif_relatorio_semanal sao e-mails dos crons;
-- notif_solicitacoes cobre as notificacoes in-app de aprovacao de demandas
-- (pendente pro gestor, aprovada/rejeitada pro colaborador que sugeriu).

begin;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

alter table colaboradores add column if not exists avatar_url text;
alter table colaboradores add column if not exists notif_lembrete_diario boolean not null default true;
alter table colaboradores add column if not exists notif_solicitacoes boolean not null default true;
alter table colaboradores add column if not exists notif_alerta_queda boolean not null default true;
alter table colaboradores add column if not exists notif_relatorio_semanal boolean not null default true;

commit;
