-- Campos novos no card pra cobrir o conjunto de metadados pedido (paridade
-- com ferramenta de referência estilo Runrun.it): tipo do card, subtarefas
-- (auto-referência — uma subtarefa é só um cartão com pai setado, herda
-- responsáveis/etiquetas/comentários/coluna de graça), datas desejadas vs.
-- entrega real, recorrência simples, tempo estimado, centro de custo
-- (reaproveita `areas`, ver nota no plano) e uma tag de referência avulsa
-- (distinta do sistema de etiquetas coloridas em `etiquetas`/`cartoes_etiquetas`).
--
-- `prazo` (já existente) continua sendo a data única de deadline — na UI vira
-- o campo "Entrega desejada"; `entregue_em` é quando o card de fato foi
-- entregue (preenchido pelas actions de mover/entregar, não pelo usuário).

begin;

alter table cartoes add column if not exists tipo text not null default 'Padrão'
  check (tipo in ('Padrão', 'Bug', 'Melhoria', 'Solicitação'));

alter table cartoes add column if not exists cartao_pai_id uuid references cartoes(id) on delete cascade;
create index if not exists cartoes_pai_idx on cartoes (cartao_pai_id);

alter table cartoes add column if not exists inicio_desejado date;
alter table cartoes add column if not exists entregue_em timestamptz;
alter table cartoes add column if not exists recorrencia jsonb;
alter table cartoes add column if not exists tempo_estimado_min integer check (tempo_estimado_min is null or tempo_estimado_min > 0);
alter table cartoes add column if not exists centro_id uuid references areas(id);
alter table cartoes add column if not exists tag_referencia text;

alter table comentarios_cartao add column if not exists tipo text not null default 'usuario'
  check (tipo in ('usuario', 'sistema'));

commit;
