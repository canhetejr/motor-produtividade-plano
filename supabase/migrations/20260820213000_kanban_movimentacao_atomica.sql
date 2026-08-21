-- Movimentação e reordenação atômicas do Kanban.
--
-- O QUE ESTAVA ERRADO
--
-- `moverCartao()` (app/(app)/kanban/actions.ts) gravava `coluna_id` num
-- UPDATE e as posições em N UPDATEs disparados juntos por Promise.all. Cada
-- um é uma transação própria: se o terceiro falhava, o card já tinha mudado
-- de coluna e as posições ficavam pela metade, sem nada para desfazer. O
-- comentário no código dizia que "uma falha parcial se recupera sozinha no
-- próximo evento de Realtime" — Realtime replica o estado gravado, ele não
-- conserta estado gravado errado.
--
-- `reordenarColunas()` tinha o mesmo desenho. `criarCartao()` calculava
-- `posicao` com count(*) fora de qualquer lock: duas pessoas criando ao mesmo
-- tempo na mesma coluna liam a mesma contagem e nasciam empatadas.
--
-- E o teto de WIP (trigger `cartoes_validar_saida_etapa`, migration
-- 20260730100000) contava os cards da coluna de destino sem travar nada.
-- Duas transações simultâneas enxergavam a mesma vaga e as duas passavam:
-- um limite de 3 aceitava o 4º card sem erro nenhum.
--
-- O QUE ESTA MIGRATION FAZ
--
-- 1. Três RPCs que executam a operação inteira numa única transação —
--    commit integral ou rollback integral, nunca meio caminho.
-- 2. Um lock consultivo por quadro, tomado ANTES de qualquer leitura que
--    decida posição, para que duas reordenações do mesmo quadro não calculem
--    em cima do mesmo retrato.
-- 3. O trigger de WIP passa a travar a linha da coluna de destino antes de
--    contar. Isso fecha a corrida também para os caminhos que NÃO passam
--    pelas RPCs (enviar pro topo, mover de quadro, automação, MCP) — o mesmo
--    raciocínio que levou essas regras a virarem trigger em 20260730100000.
--
-- ESTRATÉGIA DE POSIÇÃO: INTEIROS DENSOS, RENUMERANDO SÓ O AFETADO
--
-- Duas opções estavam na mesa: manter inteiros densos (0..n-1) renumerando as
-- colunas afetadas, ou passar a posições esparsas (saltos de 1000) para
-- escrever menos linhas por movimento.
--
-- Ficou o inteiro denso, por três motivos concretos:
--   * o esparso não elimina a renumeração, só adia — quando o intervalo entre
--     dois vizinhos fecha, é preciso rebalancear a coluna inteira, e esse
--     rebalanceamento é mais uma corrida para serializar. Troca um problema
--     conhecido por um problema raro e mais difícil de reproduzir;
--   * a interface (kanban-board.tsx) já grava o palpite otimista como
--     `forEach((id, i) => i)`, ou seja, 0..n-1. Posição esparsa faria o card
--     pular de lugar assim que o Realtime devolvesse a linha real;
--   * uma coluna de Kanban tem dezenas de cards, não milhares. Renumerar as
--     duas colunas afetadas é UM update em lote, sob um lock que já está
--     tomado.
--
-- Não há constraint UNIQUE (coluna_id, posicao) de propósito: outros caminhos
-- de escrita ainda calculam posição por contagem (enviarParaTopo,
-- moverCartaoDeQuadro, automações, templates, formulários, recorrência) e uma
-- UNIQUE transformaria uma colisão cosmética desses caminhos numa falha dura
-- para o usuário. Enquanto eles não migrarem para as RPCs, a unicidade é
-- garantida por construção dentro das funções abaixo — que são o único lugar
-- onde posição é decidida sob lock.

begin;

-- ---------------------------------------------------------------------
-- 1. Lock por quadro
-- ---------------------------------------------------------------------
-- Consultivo, e não `select ... from quadros for update`, por dois motivos:
-- não exige privilégio de UPDATE em `quadros` (colaborador comum não tem), e
-- não conflita com quem estiver editando o nome/descrição do quadro — a
-- exclusão que interessa aqui é só entre operações de ordenação.
--
-- Escopo `xact`: solta sozinho no commit ou no rollback. Lock consultivo de
-- sessão que vazasse ficaria preso ao pooler do Supabase, que reaproveita
-- conexão entre requisições de pessoas diferentes.
--
-- SECURITY DEFINER só para não depender do grant de pg_advisory_xact_lock
-- para `authenticated`. O lock continua sendo da transação de quem chama —
-- SECURITY DEFINER troca o papel de permissão, não a sessão.
--
-- ORDEM DE AQUISIÇÃO (o que evita deadlock): quadro (consultivo) → linha do
-- cartão → linha da coluna. As RPCs tomam o consultivo primeiro e só depois
-- travam linha; os caminhos legados tomam no máximo cartão → coluna, que é um
-- sufixo da mesma ordem. Nenhum caminho toma coluna antes de cartão.
create or replace function public.kanban_lock_quadro(p_quadro_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  -- hashtext colide em 1 caso em 2^32: duas travas de quadros diferentes
  -- caindo na mesma chave só serializam a mais, nunca liberam a menos.
  select pg_advisory_xact_lock(hashtext('kanban_quadro'), hashtext(p_quadro_id::text));
$$;

-- `authenticated` precisa executar porque o trigger de WIP roda com o papel de
-- quem chama, não com o do dono. Exposta em /rest/v1/rpc ela não revela nada e
-- não represa nada: cada requisição do PostgREST é uma transação, e o lock
-- morre com ela.
revoke all on function public.kanban_lock_quadro(uuid) from public, anon;
grant execute on function public.kanban_lock_quadro(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Organização de quem escreve
-- ---------------------------------------------------------------------
-- org_atual() lê auth.uid(), que é NULL sob service role — o MCP escreve por
-- ali. Mesma solução de registrar_apontamento_para (20260815140000): a regra
-- existe uma vez, parametrizada pelo colaborador, e a organização vem da
-- linha dele, nunca de parâmetro.
--
-- O join com organizacoes repete a defesa em profundidade de org_atual():
-- empresa suspensa ou expirada não escreve, mesmo que o gate da aplicação
-- tenha sido esquecido em algum caminho.
create or replace function public.kanban_org_do_colaborador(p_colaborador_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_colaborador_id is null then
    raise exception 'NAO_AUTENTICADO:sessao';
  end if;

  select c.organizacao_id into v_org
  from colaboradores c
  join organizacoes o on o.id = c.organizacao_id
  where c.id = p_colaborador_id
    and c.ativo = true
    and o.status in ('trialing', 'ativa');

  if v_org is null then
    raise exception 'ORGANIZACAO_INATIVA:conta';
  end if;

  return v_org;
end;
$$;

revoke all on function public.kanban_org_do_colaborador(uuid) from public, anon, authenticated;
grant execute on function public.kanban_org_do_colaborador(uuid) to service_role;

commit;


-- ---------------------------------------------------------------------
-- 3. WIP sob lock
-- ---------------------------------------------------------------------
-- Recriada na íntegra (as regras 1 e 2 seguem idênticas às de
-- 20260730100000) só para trocar a contagem solta pela contagem sob lock.
--
-- `for update` na linha da coluna de destino é o mesmo padrão que
-- 20260803150000_timer_blocos_finitos.sql usou para blocos finitos: quem
-- chega depois espera, e só então conta — em READ COMMITTED cada comando de
-- uma função volátil tira um snapshot novo, então a segunda transação
-- enxerga o card que a primeira acabou de comitar.
--
-- Trava sempre, mesmo em coluna sem `limite_wip`, porque ler o limite para
-- decidir se vale travar é a mesma corrida em miniatura: o limite pode ser
-- configurado entre a leitura e a contagem.
begin;

create or replace function public.cartoes_validar_saida_etapa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pendentes text;
  v_wip integer;
  v_limite integer;
begin
  if new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  -- 1. Todo pré-requisito precisa estar entregue.
  select string_agg(pre.codigo, ', ' order by pre.codigo) into v_pendentes
  from cartoes_predecessores cp
  join cartoes pre on pre.id = cp.predecessor_id
  where cp.cartao_id = new.id and pre.entregue_em is null;

  if v_pendentes is not null then
    raise exception 'PREREQUISITO_PENDENTE:%', v_pendentes;
  end if;

  -- 2. Requisito obrigatório da etapa de ORIGEM precisa estar cumprido —
  -- é a condição pra sair dela, não pra entrar na próxima.
  select string_agg(cr.descricao, '; ' order by cr.posicao) into v_pendentes
  from colunas_requisitos cr
  left join cartoes_requisitos_status crs
    on crs.requisito_id = cr.id and crs.cartao_id = new.id
  where cr.coluna_id = old.coluna_id
    and cr.obrigatorio = true
    and coalesce(crs.concluido, false) = false;

  if v_pendentes is not null then
    raise exception 'REQUISITO_OBRIGATORIO_PENDENTE:%', v_pendentes;
  end if;

  -- 3. Limite de WIP da coluna de destino, agora serializado.
  select limite_wip into v_limite from colunas where id = new.coluna_id for update;

  if v_limite is not null then
    select count(*) into v_wip from cartoes where coluna_id = new.coluna_id and id <> new.id;
    if v_wip >= v_limite then
      raise exception 'WIP_EXCEDIDO:%', v_limite;
    end if;
  end if;

  return new;
end;
$$;

commit;


-- ---------------------------------------------------------------------
-- 4. Normalização das posições existentes
-- ---------------------------------------------------------------------
-- Consequência do bug: pode haver hoje mais de um card com a mesma `posicao`
-- na mesma coluna (e colunas empatadas no mesmo quadro). Renumera preservando
-- a ordem que as telas já mostram — `posicao`, depois `created_at`, depois
-- `id` para desempate determinístico. É reordenação cosmética: nenhum card
-- muda de coluna, nenhuma coluna muda de quadro.
--
-- Os triggers de `cartoes` saem na primeira linha quando `coluna_id` não
-- muda (`new.coluna_id is not distinct from old.coluna_id`), então este
-- update não dispara entrega, WIP nem carimbo de etapa.
begin;

with numerado as (
  select id, (row_number() over (partition by coluna_id order by posicao, created_at, id) - 1)::int as nova
  from public.cartoes
)
update public.cartoes c
set posicao = n.nova
from numerado n
where n.id = c.id and c.posicao is distinct from n.nova;

with numerado as (
  select id, (row_number() over (partition by quadro_id order by posicao, created_at, id) - 1)::int as nova
  from public.colunas
)
update public.colunas c
set posicao = n.nova
from numerado n
where n.id = c.id and c.posicao is distinct from n.nova;

commit;


-- ---------------------------------------------------------------------
-- 5. RPC: mover / reordenar cartão
-- ---------------------------------------------------------------------
-- SECURITY DEFINER ignora RLS por construção, então a checagem de organização
-- é escrita à mão em cada leitura (regra 4 da skill vertice-isolamento):
-- TODO id que vem de fora — cartão, coluna de destino, ids dentro de
-- `p_ordens` — é relido com `organizacao_id = v_org` antes de virar escrita.
-- A autorização de quadro reusa `pode_acessar_quadro`, a mesma regra das
-- policies (gestor ativo da organização OU membro do quadro).
--
-- `p_ordens` é o mesmo formato que a interface já monta:
--   [{"colunaId": "...", "cartaoIds": ["...", "..."]}, ...]
-- Ele é tratado como PALPITE DE ORDEM, não como verdade:
--   * id de card que não está mesmo naquela coluna depois do movimento é
--     recusado (é assim que um card de outro quadro ou de outra empresa não
--     entra na renumeração);
--   * coluna fora do par origem/destino é recusada;
--   * card que a pessoa não tinha na tela (criado por outra pessoa enquanto
--     ela arrastava) NÃO é recusado — vai para o fim da coluna, pela posição
--     atual. Recusar aqui transformaria toda criação concorrente num erro na
--     cara de quem só arrastou um card.
--
-- Arrastar para o mesmo lugar é idempotente: nada muda de coluna, a
-- renumeração devolve as mesmas posições, e `movido` volta false — é o que
-- impede a Server Action de disparar automação e Google de novo.

begin;

create or replace function public.kanban_mover_cartao_para(
  p_colaborador_id uuid,
  p_cartao_id uuid,
  p_coluna_destino_id uuid,
  p_ordens jsonb default null,
  p_via text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_quadro_id uuid;
  v_cartao_id uuid;
  v_cartao_coluna_id uuid;
  v_cartao_pai_id uuid;
  v_codigo text;
  v_titulo text;
  v_origem_id uuid;
  v_origem_nome text;
  v_origem_quadro_id uuid;
  v_destino_id uuid;
  v_destino_nome text;
  v_destino_quadro_id uuid;
  v_ordens jsonb;
  v_invalidos integer;
  v_afetadas uuid[];
  v_movido boolean := false;
  v_entregue boolean := false;
begin
  v_org := public.kanban_org_do_colaborador(p_colaborador_id);

  if p_cartao_id is null then
    raise exception 'CARTAO_NAO_ENCONTRADO:origem';
  end if;
  if p_coluna_destino_id is null then
    raise exception 'COLUNA_INVALIDA:destino';
  end if;
  if p_ordens is not null and jsonb_typeof(p_ordens) <> 'array' then
    raise exception 'ORDEM_INVALIDA:formato';
  end if;

  -- Leitura sem trava só para descobrir o quadro: o lock consultivo tem de
  -- ser tomado ANTES de qualquer trava de linha (ver ordem de aquisição no
  -- topo), e não dá para travar o quadro sem saber qual é.
  select col.quadro_id into v_quadro_id
  from cartoes c
  join colunas col on col.id = c.coluna_id and col.organizacao_id = c.organizacao_id
  where c.id = p_cartao_id and c.organizacao_id = v_org;

  if not found then
    -- Mesma mensagem para "não existe" e "é de outra empresa": distinguir as
    -- duas transformaria a RPC num oráculo de ids alheios.
    raise exception 'CARTAO_NAO_ENCONTRADO:origem';
  end if;

  if not public.pode_acessar_quadro(v_quadro_id, p_colaborador_id) then
    raise exception 'NAO_AUTORIZADO:quadro';
  end if;

  perform public.kanban_lock_quadro(v_quadro_id);

  -- Releitura autoritativa sob o lock: entre a leitura acima e agora, outra
  -- transação pode ter movido este card.
  select c.id, c.coluna_id, c.cartao_pai_id, c.codigo, c.titulo
  into v_cartao_id, v_cartao_coluna_id, v_cartao_pai_id, v_codigo, v_titulo
  from cartoes c
  where c.id = p_cartao_id and c.organizacao_id = v_org
  for update;

  if not found then
    raise exception 'CARTAO_NAO_ENCONTRADO:origem';
  end if;

  select col.id, col.nome, col.quadro_id into v_origem_id, v_origem_nome, v_origem_quadro_id
  from colunas col
  where col.id = v_cartao_coluna_id and col.organizacao_id = v_org;

  if not found or v_origem_quadro_id <> v_quadro_id then
    raise exception 'CARTAO_NAO_ENCONTRADO:origem';
  end if;

  select col.id, col.nome, col.quadro_id into v_destino_id, v_destino_nome, v_destino_quadro_id
  from colunas col
  where col.id = p_coluna_destino_id and col.organizacao_id = v_org;

  if not found then
    raise exception 'COLUNA_INVALIDA:destino';
  end if;

  -- Mover entre quadros é outra operação no domínio (moverCartaoDeQuadro, com
  -- regras próprias de responsáveis e etiquetas). Fazer "quase isso" aqui
  -- seria pior do que recusar.
  if v_destino_quadro_id <> v_quadro_id then
    raise exception 'QUADRO_DIVERGENTE:destino';
  end if;

  v_afetadas := array(select distinct x from unnest(array[v_origem_id, v_destino_id]) x);

  -- Achata p_ordens em {coluna_id, cartao_id, ordem}. O casamento com o
  -- formato de UUID evita que um id malformado vire erro 22P02 sem mensagem
  -- de domínio.
  select coalesce(
    jsonb_agg(jsonb_build_object('coluna_id', cid, 'cartao_id', kid, 'ordem', ord) order by ord),
    '[]'::jsonb
  )
  into v_ordens
  from (
    select
      case when (o.item->>'colunaId') ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
           then (o.item->>'colunaId')::uuid end as cid,
      case when e.valor ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
           then e.valor::uuid end as kid,
      (o.ord * 1000000 + e.ord) as ord
    from jsonb_array_elements(coalesce(p_ordens, '[]'::jsonb)) with ordinality as o(item, ord)
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(o.item->'cartaoIds') = 'array' then o.item->'cartaoIds' else '[]'::jsonb end
    ) with ordinality as e(valor, ord)
  ) achatado;

  if exists (
    select 1 from jsonb_to_recordset(v_ordens) as r(coluna_id uuid, cartao_id uuid, ordem bigint)
    where r.coluna_id is null or r.cartao_id is null
  ) then
    raise exception 'ORDEM_INVALIDA:identificador';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_ordens) as r(coluna_id uuid, cartao_id uuid, ordem bigint)
    where not (r.coluna_id = any(v_afetadas))
  ) then
    raise exception 'ORDEM_INVALIDA:coluna';
  end if;

  -- Card citado duas vezes deixaria a renumeração ambígua.
  if (
    select count(*) <> count(distinct r.cartao_id)
    from jsonb_to_recordset(v_ordens) as r(coluna_id uuid, cartao_id uuid, ordem bigint)
  ) then
    raise exception 'ORDEM_INVALIDA:duplicado';
  end if;

  -- O movimento em si continua sendo um UPDATE de `coluna_id`, para que os
  -- triggers de 20260730100000 (pré-requisito, requisito da etapa, WIP) e o
  -- de entrega/etapa_desde vejam old.coluna_id <> new.coluna_id exatamente
  -- como viam antes. É aqui que WIP_EXCEDIDO pode abortar tudo — e como é a
  -- mesma transação, a renumeração e o comentário abaixo não acontecem.
  if v_destino_id <> v_origem_id then
    update cartoes set coluna_id = v_destino_id where id = v_cartao_id;
    v_movido := true;
  end if;

  -- Validação DEPOIS do movimento, contra o estado final: todo id recebido
  -- tem de estar mesmo na coluna em que o cliente disse que ele está. Card de
  -- outra coluna, de outro quadro ou de outra empresa cai aqui, e a exceção
  -- desfaz inclusive o UPDATE acima.
  select count(*) into v_invalidos
  from jsonb_to_recordset(v_ordens) as r(coluna_id uuid, cartao_id uuid, ordem bigint)
  left join cartoes c on c.id = r.cartao_id and c.organizacao_id = v_org
  where c.id is null or c.coluna_id <> r.coluna_id;

  if v_invalidos > 0 then
    raise exception 'ORDEM_INVALIDA:conteudo';
  end if;

  -- Renumeração em lote das colunas afetadas. `ordem nulls last` põe no fim
  -- quem o cliente não listou; o `case` garante que um card movido sem
  -- `p_ordens` (caminho do MCP) entre no fim do destino, e não empatado com
  -- quem já estava lá.
  with recebido as (
    select r.coluna_id, r.cartao_id, r.ordem
    from jsonb_to_recordset(v_ordens) as r(coluna_id uuid, cartao_id uuid, ordem bigint)
  ),
  final as (
    select
      c.id,
      (row_number() over (
        partition by c.coluna_id
        order by
          rc.ordem nulls last,
          case when c.id = v_cartao_id and rc.ordem is null then 1 else 0 end,
          c.posicao,
          c.created_at,
          c.id
      ) - 1)::int as nova
    from cartoes c
    left join recebido rc on rc.cartao_id = c.id and rc.coluna_id = c.coluna_id
    where c.coluna_id = any(v_afetadas) and c.organizacao_id = v_org
  )
  update cartoes c
  set posicao = f.nova
  from final f
  where c.id = f.id and c.posicao is distinct from f.nova;

  if v_movido then
    insert into comentarios_cartao (cartao_id, colaborador_id, conteudo, tipo, organizacao_id)
    values (
      v_cartao_id,
      p_colaborador_id,
      'Moveu o card de "' || v_origem_nome || '" para "' || v_destino_nome || '"'
        || coalesce(' (via ' || p_via || ')', '') || '.',
      'sistema',
      v_org
    );
  end if;

  -- Lido depois do movimento: o trigger de entrega pode ter acabado de
  -- carimbar `entregue_em`, e é isso que decide o evento subtarefa_entregue.
  select c.entregue_em is not null into v_entregue from cartoes c where c.id = v_cartao_id;

  return jsonb_build_object(
    'movido', v_movido,
    'cartaoId', v_cartao_id,
    'codigo', v_codigo,
    'titulo', v_titulo,
    'quadroId', v_quadro_id,
    'colunaOrigemId', v_origem_id,
    'colunaOrigemNome', v_origem_nome,
    'colunaDestinoId', v_destino_id,
    'colunaDestinoNome', v_destino_nome,
    'ehSubtarefa', v_cartao_pai_id is not null,
    'entregue', coalesce(v_entregue, false)
  );
end;
$$;

-- Só service_role: a função aceita QUALQUER colaborador como parâmetro. Com
-- grant para `authenticated`, uma pessoa logada moveria card no nome de outra
-- — exatamente o que o auth.uid() do wrapper impede. Mesmo critério de
-- registrar_apontamento_para (20260815140000).
revoke all on function public.kanban_mover_cartao_para(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.kanban_mover_cartao_para(uuid, uuid, uuid, jsonb, text) to service_role;

create or replace function public.kanban_mover_cartao(
  p_cartao_id uuid,
  p_coluna_destino_id uuid,
  p_ordens jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.kanban_mover_cartao_para(auth.uid(), p_cartao_id, p_coluna_destino_id, p_ordens, null);
end;
$$;

revoke all on function public.kanban_mover_cartao(uuid, uuid, jsonb) from public, anon;
grant execute on function public.kanban_mover_cartao(uuid, uuid, jsonb) to authenticated;

commit;


-- ---------------------------------------------------------------------
-- 6. RPC: criar cartão com posição atômica
-- ---------------------------------------------------------------------
-- A posição sai de max(posicao) + 1 SOB o lock do quadro. Era o count(*) solto
-- de criarCartao()/criarCartaoMcp() que deixava dois cards nascerem na mesma
-- posição quando duas pessoas criavam ao mesmo tempo na mesma coluna.
--
-- Os responsáveis entram na MESMA transação. Antes o vínculo era um insert
-- separado cujo erro era ignorado: o card nascia sem dono e ninguém ficava
-- sabendo. Agora, ou nascem os dois, ou não nasce nada.
--
-- `p_dados` é jsonb com uma lista fechada de chaves em vez de 12 parâmetros:
-- o card ganha campo com frequência e cada campo novo mudaria a assinatura da
-- função (e obrigaria a recriar as duas variantes). As chaves são lidas uma a
-- uma abaixo — nada que não esteja nesta lista chega ao INSERT.

begin;

create or replace function public.kanban_criar_cartao_para(
  p_colaborador_id uuid,
  p_quadro_id uuid,
  p_coluna_id uuid,
  p_dados jsonb,
  p_responsaveis uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_coluna_id uuid;
  v_coluna_nome text;
  v_quadro_id uuid;
  v_titulo text;
  v_pai_id uuid;
  v_demanda_id uuid;
  v_centro_id uuid;
  v_posicao integer;
  v_responsaveis uuid[];
  v_id uuid;
  v_codigo text;
  v_referencia text;
begin
  v_org := public.kanban_org_do_colaborador(p_colaborador_id);

  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'DADOS_INVALIDOS:cartao';
  end if;

  v_titulo := nullif(btrim(coalesce(p_dados->>'titulo', '')), '');
  if v_titulo is null then
    raise exception 'TITULO_OBRIGATORIO:cartao';
  end if;

  select col.id, col.nome, col.quadro_id into v_coluna_id, v_coluna_nome, v_quadro_id
  from colunas col
  where col.id = p_coluna_id and col.organizacao_id = v_org;

  if not found then
    raise exception 'COLUNA_INVALIDA:destino';
  end if;

  -- O quadro vem por parâmetro só para ser CONFERIDO. Quem chama valida
  -- responsáveis e demanda contra um quadro; se a coluna fosse de outro, a
  -- validação teria sido feita contra o quadro errado.
  if p_quadro_id is not null and p_quadro_id <> v_quadro_id then
    raise exception 'COLUNA_INVALIDA:quadro';
  end if;

  if not public.pode_acessar_quadro(v_quadro_id, p_colaborador_id) then
    raise exception 'NAO_AUTORIZADO:quadro';
  end if;

  v_pai_id := nullif(p_dados->>'cartao_pai_id', '')::uuid;
  if v_pai_id is not null and not exists (
    select 1 from cartoes where id = v_pai_id and organizacao_id = v_org
  ) then
    raise exception 'CARTAO_NAO_ENCONTRADO:pai';
  end if;

  -- demandas e areas têm FK simples a partir de cartoes (não composta), então
  -- o eixo aqui é conferido à mão — sem isso um id de outra empresa entraria.
  v_demanda_id := nullif(p_dados->>'demanda_id', '')::uuid;
  if v_demanda_id is not null and not exists (
    select 1 from demandas where id = v_demanda_id and organizacao_id = v_org and ativo = true
  ) then
    raise exception 'DEMANDA_INVALIDA:catalogo';
  end if;

  v_centro_id := nullif(p_dados->>'centro_id', '')::uuid;
  if v_centro_id is not null and not exists (
    select 1 from areas where id = v_centro_id and organizacao_id = v_org
  ) then
    raise exception 'CENTRO_INVALIDO:area';
  end if;

  v_responsaveis := array(select distinct x from unnest(coalesce(p_responsaveis, '{}'::uuid[])) x where x is not null);
  if array_length(v_responsaveis, 1) is not null and exists (
    select 1 from unnest(v_responsaveis) x
    where not exists (
      select 1 from colaboradores c
      where c.id = x and c.organizacao_id = v_org and c.ativo = true
    )
  ) then
    raise exception 'RESPONSAVEL_INVALIDO:vinculo';
  end if;

  perform public.kanban_lock_quadro(v_quadro_id);

  -- max + 1, e não count(*): coluna com posições esburacadas (card excluído)
  -- reaproveitaria uma posição já ocupada se a conta fosse por contagem.
  select coalesce(max(posicao) + 1, 0) into v_posicao
  from cartoes where coluna_id = v_coluna_id and organizacao_id = v_org;

  insert into cartoes (
    coluna_id, codigo, titulo, descricao, prioridade, prazo, tipo, inicio_desejado,
    tempo_estimado_min, centro_id, demanda_id, tag_referencia, recorrencia,
    cartao_pai_id, posicao, criado_por, organizacao_id
  ) values (
    v_coluna_id,
    -- Sobrescrito por gerar_referencia_cartao (BEFORE INSERT, 20260820200000).
    '',
    v_titulo,
    nullif(p_dados->>'descricao', ''),
    coalesce(nullif(p_dados->>'prioridade', ''), 'media'),
    nullif(p_dados->>'prazo', '')::date,
    coalesce(nullif(p_dados->>'tipo', ''), 'Padrão'),
    nullif(p_dados->>'inicio_desejado', '')::date,
    nullif(p_dados->>'tempo_estimado_min', '')::integer,
    v_centro_id,
    v_demanda_id,
    nullif(p_dados->>'tag_referencia', ''),
    case when jsonb_typeof(p_dados->'recorrencia') = 'object' then p_dados->'recorrencia' end,
    v_pai_id,
    v_posicao,
    p_colaborador_id,
    v_org
  )
  returning id, codigo, referencia, posicao into v_id, v_codigo, v_referencia, v_posicao;

  if array_length(v_responsaveis, 1) is not null then
    insert into cartoes_responsaveis (cartao_id, colaborador_id, organizacao_id)
    select v_id, x, v_org from unnest(v_responsaveis) x;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'codigo', v_codigo,
    'referencia', v_referencia,
    'titulo', v_titulo,
    'posicao', v_posicao,
    'colunaId', v_coluna_id,
    'colunaNome', v_coluna_nome,
    'quadroId', v_quadro_id
  );
end;
$$;

revoke all on function public.kanban_criar_cartao_para(uuid, uuid, uuid, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.kanban_criar_cartao_para(uuid, uuid, uuid, jsonb, uuid[]) to service_role;

create or replace function public.kanban_criar_cartao(
  p_quadro_id uuid,
  p_coluna_id uuid,
  p_dados jsonb,
  p_responsaveis uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.kanban_criar_cartao_para(auth.uid(), p_quadro_id, p_coluna_id, p_dados, p_responsaveis);
end;
$$;

revoke all on function public.kanban_criar_cartao(uuid, uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.kanban_criar_cartao(uuid, uuid, jsonb, uuid[]) to authenticated;

commit;


-- ---------------------------------------------------------------------
-- 7. RPC: reordenar colunas do quadro
-- ---------------------------------------------------------------------
-- Exige a lista COMPLETA das colunas do quadro. Aceitar lista parcial faria a
-- renumeração produzir posições fora de 0..n-1 sem que ninguém percebesse; e
-- o caso em que a lista ficou parcial é justamente aquele em que outra pessoa
-- acabou de criar ou excluir uma coluna — situação que a tela precisa
-- recarregar, não "resolver na média".

begin;

create or replace function public.kanban_reordenar_colunas_para(
  p_colaborador_id uuid,
  p_quadro_id uuid,
  p_coluna_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_recebidas integer;
  v_total integer;
begin
  v_org := public.kanban_org_do_colaborador(p_colaborador_id);

  if p_quadro_id is null or not exists (
    select 1 from quadros where id = p_quadro_id and organizacao_id = v_org
  ) then
    raise exception 'NAO_AUTORIZADO:quadro';
  end if;

  if not public.pode_acessar_quadro(p_quadro_id, p_colaborador_id) then
    raise exception 'NAO_AUTORIZADO:quadro';
  end if;

  v_recebidas := coalesce(array_length(p_coluna_ids, 1), 0);
  if v_recebidas = 0 then
    raise exception 'ORDEM_INVALIDA:colunas';
  end if;

  if (select count(distinct x) from unnest(p_coluna_ids) x) <> v_recebidas then
    raise exception 'ORDEM_INVALIDA:duplicado';
  end if;

  perform public.kanban_lock_quadro(p_quadro_id);

  -- Coluna de outro quadro (ou de outra empresa) na lista: recusa. Sem isto,
  -- o UPDATE abaixo reposicionaria coluna alheia só porque o id foi enviado.
  if exists (
    select 1 from unnest(p_coluna_ids) x
    where not exists (
      select 1 from colunas c
      where c.id = x and c.quadro_id = p_quadro_id and c.organizacao_id = v_org
    )
  ) then
    raise exception 'COLUNA_INVALIDA:quadro';
  end if;

  select count(*) into v_total from colunas
  where quadro_id = p_quadro_id and organizacao_id = v_org;

  if v_total <> v_recebidas then
    raise exception 'COLUNAS_DESATUALIZADAS:%', v_total;
  end if;

  update colunas c
  set posicao = nova.posicao
  from (
    select x.id, (x.ord - 1)::int as posicao
    from unnest(p_coluna_ids) with ordinality as x(id, ord)
  ) nova
  where c.id = nova.id and c.posicao is distinct from nova.posicao;

  return v_total;
end;
$$;

revoke all on function public.kanban_reordenar_colunas_para(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.kanban_reordenar_colunas_para(uuid, uuid, uuid[]) to service_role;

create or replace function public.kanban_reordenar_colunas(p_quadro_id uuid, p_coluna_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.kanban_reordenar_colunas_para(auth.uid(), p_quadro_id, p_coluna_ids);
end;
$$;

revoke all on function public.kanban_reordenar_colunas(uuid, uuid[]) from public, anon;
grant execute on function public.kanban_reordenar_colunas(uuid, uuid[]) to authenticated;

comment on function public.kanban_mover_cartao_para(uuid, uuid, uuid, jsonb, text) is
  'Move e reordena cartão numa única transação, sob lock consultivo do quadro. '
  'WIP, pré-requisito e requisito de etapa são validados pelos triggers de cartoes.';
comment on function public.kanban_criar_cartao_para(uuid, uuid, uuid, jsonb, uuid[]) is
  'Cria cartão e responsáveis numa única transação, com posição calculada sob lock do quadro.';
comment on function public.kanban_reordenar_colunas_para(uuid, uuid, uuid[]) is
  'Reordena TODAS as colunas do quadro numa única transação; recusa id fora do quadro.';

commit;
