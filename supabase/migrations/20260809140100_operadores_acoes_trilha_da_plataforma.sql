-- Trilha das ações do operador da plataforma.
--
-- Existe porque `auditoria` não serve para isto, e a tentativa atual falha
-- em silêncio: a FK composta auditoria_ator_org exige (ator_id,
-- organizacao_id) presente em colaboradores, e o operador NÃO é colaborador
-- de organização nenhuma — é dono da plataforma. Verificado antes de criar
-- esta tabela: o insert que app/(operador)/console/actions.ts faz hoje
-- devolve 23503, e registrarAuditoria() engole o erro no try/catch. Ou seja,
-- suspender e reativar cliente vinha acontecendo sem registro.
--
-- Fora do eixo de organização de propósito, como `operadores` e
-- `cron_execucoes`: RLS ligada e ZERO políticas, só service role lê e
-- escreve. `organizacao_id` aqui é o ALVO da ação, não o eixo de isolamento
-- — e é anulável porque há ação sem alvo (e porque o registro de "excluí a
-- organização X" precisa sobreviver à exclusão dela).
create table if not exists public.operadores_acoes (
  id uuid primary key default gen_random_uuid(),
  operador_id uuid not null references auth.users(id),
  acao text not null,
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  -- Nome guardado junto: com on delete set null, sem isto o registro de uma
  -- organização apagada vira uma linha órfã que não diz sobre quem foi.
  organizacao_nome text,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_operadores_acoes_criado_em on public.operadores_acoes (criado_em desc);
create index if not exists idx_operadores_acoes_organizacao_id on public.operadores_acoes (organizacao_id);

alter table public.operadores_acoes enable row level security;
