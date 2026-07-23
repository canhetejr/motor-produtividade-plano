-- Colaborador não conseguia retirar uma sugestão enviada por engano — só
-- dava pra esperar o gestor aprovar/rejeitar. Permite cancelar (delete)
-- a própria solicitação enquanto ainda está PENDENTE.

begin;

drop policy if exists "solicitacoes_delete_own_pendente" on solicitacoes_demandas;
create policy "solicitacoes_delete_own_pendente" on solicitacoes_demandas for delete
  using (colaborador_id = auth.uid() and status = 'PENDENTE');

commit;
