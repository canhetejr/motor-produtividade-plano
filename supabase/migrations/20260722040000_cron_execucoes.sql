-- Nenhum dos 3 crons (lembrete-diario, alerta-queda, relatorio-semanal)
-- registrava execução — um retry da Vercel ou um hit manual na rota
-- reenviava os mesmos e-mails do período. cron_execucoes é só uma trava de
-- idempotência: (tipo, chave) único, sem RLS (só service_role acessa, de
-- dentro das rotas de cron).

begin;

create table if not exists cron_execucoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  chave text not null,
  executado_em timestamptz not null default now(),
  unique (tipo, chave)
);

-- Sem policy nenhuma de propósito: service_role (usado pelos crons) ignora
-- RLS de qualquer jeito, e habilitar aqui garante que anon/authenticated não
-- tenham acesso nenhum por padrão (mesmo raciocínio da migration 0002).
alter table cron_execucoes enable row level security;
revoke all on cron_execucoes from anon, authenticated;

commit;
