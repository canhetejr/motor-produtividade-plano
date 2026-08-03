-- Conexões OAuth do Google Workspace por colaborador. Os tokens nunca são
-- expostos pela API: somente o servidor, via service role, pode lê-los.
create table if not exists public.google_workspace_conexoes (
  colaborador_id uuid primary key references public.colaboradores(id) on delete cascade,
  email text not null,
  refresh_token_cifrado text not null,
  escopos text[] not null default '{}',
  conectado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.google_calendar_eventos (
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  cartao_id uuid not null references public.cartoes(id) on delete cascade,
  google_event_id text not null,
  atualizado_em timestamptz not null default now(),
  primary key (colaborador_id, cartao_id)
);

alter table public.google_workspace_conexoes enable row level security;
alter table public.google_calendar_eventos enable row level security;
revoke all on public.google_workspace_conexoes, public.google_calendar_eventos from anon, authenticated;
