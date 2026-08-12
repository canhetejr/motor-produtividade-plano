-- Assinaturas comerciais geridas manualmente pelo operador da plataforma.
--
-- Esta é uma fundação deliberadamente sem gateway: a fonte de verdade é o
-- contrato comercial lançado pelo operador, não uma simulação de Stripe/PIX.
-- A tabela fica fora do eixo do tenant como `operadores_acoes`: clientes não
-- podem ler nem alterar a própria condição comercial; somente service role
-- após requireOperador() no servidor acessa estes registros.
create table public.assinaturas_manuais (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  plano_id uuid not null references public.planos(id) on delete restrict,
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'cancelada')),
  ciclo_cobranca text not null check (ciclo_cobranca in ('mensal', 'trimestral', 'semestral', 'anual')),
  inicia_em date not null,
  renova_em date,
  proxima_cobranca_em date,
  valor_centavos integer not null check (valor_centavos >= 0),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint assinaturas_manuais_datas_coerentes check (
    (renova_em is null or renova_em >= inicia_em)
    and (proxima_cobranca_em is null or proxima_cobranca_em >= inicia_em)
    and (status <> 'ativa' or (renova_em is not null and proxima_cobranca_em is not null))
  )
);

-- Uma organização pode ter histórico cancelado, mas só uma assinatura vigente
-- (ativa ou pausada) para impedir duas fontes comerciais concorrentes.
create unique index assinaturas_manuais_uma_vigente_por_organizacao
  on public.assinaturas_manuais (organizacao_id)
  where status in ('ativa', 'pausada');
create index assinaturas_manuais_organizacao_idx on public.assinaturas_manuais (organizacao_id, atualizado_em desc);
create index assinaturas_manuais_proxima_cobranca_idx on public.assinaturas_manuais (proxima_cobranca_em)
  where status = 'ativa';

create or replace function public.trg_assinaturas_manuais_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger assinaturas_manuais_atualizado_em
  before update on public.assinaturas_manuais
  for each row execute function public.trg_assinaturas_manuais_atualizado_em();

alter table public.assinaturas_manuais enable row level security;
revoke all on table public.assinaturas_manuais from anon, authenticated;
-- Sem políticas intencionalmente: service_role ignora RLS, e o único caminho
-- de aplicação é app/(operador)/console/actions.ts protegido por requireOperador().
