-- Corrige a semântica de exclusão da FK de propriedade criada em 20260812200000.
--
-- A organização referencia seu dono pela FK composta
-- (dono_colaborador_id, id) -> colaboradores(id, organizacao_id). A exclusão
-- definitiva da organização remove colaboradores por cascade; SET NULL impede
-- que essa referência circular bloqueie o cascade. A linha de organização está
-- sendo apagada, portanto não persiste nenhuma organização sem dono.

begin;

alter table public.organizacoes
  drop constraint if exists organizacoes_dono_org;

alter table public.organizacoes
  add constraint organizacoes_dono_org
  foreign key (dono_colaborador_id, id)
  references public.colaboradores (id, organizacao_id)
  on delete set null (dono_colaborador_id);

commit;
