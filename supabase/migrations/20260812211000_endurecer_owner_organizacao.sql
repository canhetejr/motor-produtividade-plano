-- Endurece e indexa o mecanismo de dono da organização.
--
-- `colaboradores_proteger_dono` é chamado exclusivamente pelo trigger; não é
-- uma RPC pública e não deve conservar EXECUTE implícito para anon/authenticated.
-- A FK composta ganha índice no lado referenciante para não degradar updates ou
-- exclusões de colaboradores conforme a quantidade de organizações crescer.

begin;

revoke all on function public.colaboradores_proteger_dono() from public, anon, authenticated;

create index if not exists organizacoes_dono_colaborador_id_id_idx
  on public.organizacoes (dono_colaborador_id, id);

commit;
