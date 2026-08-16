-- Gate 3 do docs/PLANO-MCP-PRODUTO.md: proteção operacional do endpoint MCP.
--
-- O plano exige rate limit por token resolvido e por IP, e adverte: escolher
-- armazenamento compatível com containers/restarts do Coolify, e não afirmar
-- proteção distribuída se ela não existir. Um contador em memória do processo
-- não serve — o app roda em container que reinicia a cada deploy, e cada
-- réplica teria seu próprio contador, multiplicando o limite pelo número de
-- réplicas sem ninguém perceber.
--
-- Não há Redis neste projeto. O Postgres que já está ali atende: um upsert
-- atômico por janela custa um round-trip e vale para todas as réplicas ao
-- mesmo tempo. É mais caro que Redis e é honesto sobre o que garante.
--
-- Janela FIXA, não deslizante. A janela fixa deixa passar até 2x o limite na
-- virada (fim de uma janela + início da seguinte); a deslizante exigiria
-- guardar timestamp por requisição. Para o objetivo aqui — conter abuso e
-- laço descontrolado de agente, não modelar tráfego com precisão — o custo da
-- deslizante não se paga. Fica registrado que o teto real é 2x na borda.

create table if not exists public.mcp_rate_limite (
  -- Já vem qualificada por quem a monta em lib/mcp/rate-limit.ts:
  -- 'token:<uuid>' ou 'ip:<endereco>'. Sem organizacao_id de propósito: isto
  -- é infraestrutura do endpoint, não dado de negócio — não há leitura de
  -- inquilino a isolar, e o limite por IP é anterior a qualquer identidade
  -- resolvida (não existe organização a que atribuí-lo).
  chave text not null,
  janela_inicio timestamptz not null,
  contador integer not null default 0,
  primary key (chave, janela_inicio)
);

-- Varredura de janelas vencidas (a função abaixo limpa por amostragem).
create index if not exists idx_mcp_rate_limite_janela on public.mcp_rate_limite (janela_inicio);

alter table public.mcp_rate_limite enable row level security;

-- Nenhuma política: só service_role escreve e lê, de dentro de
-- lib/mcp/rate-limit.ts. Mesmo padrão de cron_execucoes — o advisor aponta
-- rls_enabled_no_policy como INFO nesses casos, e é o resultado desejado
-- (RLS ligada + zero política = ninguém autenticado alcança a tabela).
revoke all on public.mcp_rate_limite from anon, authenticated;

/**
 * Consome uma unidade da cota de `p_chave` na janela corrente e devolve se a
 * requisição pode seguir.
 *
 * O upsert com `contador = mcp_rate_limite.contador + 1` é a parte que
 * importa: o incremento acontece dentro do banco, numa única declaração, e
 * duas requisições simultâneas da mesma chave não conseguem ler o mesmo valor
 * e gravar o mesmo resultado. Fazer isso como SELECT-depois-UPDATE no
 * TypeScript reintroduziria exatamente a corrida que o limite deveria evitar.
 */
create or replace function public.mcp_consumir_rate_limit(
  p_chave text,
  p_limite integer,
  p_janela_segundos integer
)
returns table (permitido boolean, restante integer, reinicia_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_contador integer;
begin
  -- Alinha a janela a múltiplos de p_janela_segundos desde a época: todas as
  -- réplicas calculam o mesmo início sem precisar combinar nada.
  v_inicio := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_janela_segundos) * p_janela_segundos);

  insert into public.mcp_rate_limite (chave, janela_inicio, contador)
  values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio)
  do update set contador = public.mcp_rate_limite.contador + 1
  returning contador into v_contador;

  -- Limpeza por amostragem: ~1% das chamadas paga a varredura, o que mantém a
  -- tabela pequena sem precisar de cron dedicado nem de um job que alguém
  -- esqueça de criar no próximo ambiente.
  if random() < 0.01 then
    delete from public.mcp_rate_limite where janela_inicio < v_inicio - interval '1 hour';
  end if;

  return query select
    v_contador <= p_limite,
    greatest(p_limite - v_contador, 0),
    v_inicio + make_interval(secs => p_janela_segundos);
end;
$$;

revoke all on function public.mcp_consumir_rate_limit(text, integer, integer) from public;
revoke all on function public.mcp_consumir_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.mcp_consumir_rate_limit(text, integer, integer) to service_role;

-- ============================================================
-- Promove mcp_tokens_escopos_validos de NOT VALID para validada
-- ============================================================
-- A constraint entrou NOT VALID em 20260815140000 porque não dava para
-- afirmar, de dentro daquela migration, que nenhuma linha histórica tinha
-- array vazio (a coluna nasceu com default '{}'). Conferido depois: produção
-- e o ambiente de integração têm 4 tokens cada, nenhum vazio, nenhum fora do
-- catálogo, nenhum com duplicata.
--
-- Falha em voz alta se encontrar linha ruim, em vez de pular em silêncio: um
-- token com escopo inválido é uma pergunta para uma pessoa responder
-- (revogar? corrigir?), não algo para uma migration decidir sozinha. Como a
-- constraint já barra INSERT/UPDATE desde 15/08, linha nova ruim não existe.
do $$
declare
  v_ruins integer;
begin
  select count(*) into v_ruins
  from public.mcp_tokens
  where not public.mcp_escopos_validos(escopos);

  if v_ruins > 0 then
    raise exception 'mcp_tokens tem % linha(s) com escopos inválidos. Revise-as (revogar ou corrigir) antes de validar a constraint: select id, token_prefixo, escopos from public.mcp_tokens where not public.mcp_escopos_validos(escopos);', v_ruins;
  end if;

  alter table public.mcp_tokens validate constraint mcp_tokens_escopos_validos;
end $$;
