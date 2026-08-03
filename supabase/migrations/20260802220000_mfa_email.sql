-- F19: segundo fator por codigo enviado ao e-mail.
--
-- O MFA nativo do Supabase (TOTP) exigiria habilitacao no painel. Este usa o
-- SMTP que esta aplicacao ja opera, entao nao depende de configuracao externa.
--
-- LIMITE, dito aqui para nao ser esquecido: a sessao do Supabase e criada assim
-- que a senha confere; o que o segundo fator bloqueia e o USO DO APP, pela
-- proxy, ate o codigo ser verificado. Isso cobre o caso que o 2FA existe para
-- cobrir — quem tem so a senha nao entra. Nao cobre quem ja extraiu o cookie de
-- sessao do aparelho, que a essa altura ja tem acesso ao aparelho.
alter table public.colaboradores
  add column if not exists mfa_email_ativo boolean not null default false;

create table if not exists public.desafios_mfa (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  -- Hash com sal, nao o codigo. Um vazamento de leitura desta tabela nao pode
  -- entregar o segundo fator de ninguem.
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas integer not null default 0,
  verificado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists idx_desafios_mfa_colaborador_id on public.desafios_mfa (colaborador_id);
create index if not exists idx_desafios_mfa_pendentes
  on public.desafios_mfa (colaborador_id, criado_em) where verificado_em is null;

alter table public.desafios_mfa enable row level security;
-- NENHUM grant e NENHUMA policy: so a service role. O desafio e criado e
-- verificado no servidor; deixar o proprio usuario ler a tabela permitiria
-- contar tentativas alheias e, com o hash em maos, atacar offline.
revoke all on public.desafios_mfa from anon, authenticated;
