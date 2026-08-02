-- advisor multiple_permissive_policies: em oito tabelas havia uma politica
-- FOR ALL de escrita convivendo com uma FOR SELECT de leitura. FOR ALL cobre
-- SELECT, entao o Postgres avaliava as duas e fazia OR a cada consulta.
--
-- A correcao NAO e uniforme, e essa e a parte que importa. Em quatro tabelas a
-- politica de leitura ja e mais ampla que a de escrita (`true`, ou
-- `ativo OR membro` contra `membro`), entao basta restringir a escrita a
-- INSERT/UPDATE/DELETE. Nas outras quatro a politica de escrita concede leitura
-- que a de leitura NAO concede — um gestor que nao e membro do quadro le todos
-- os quadros por causa dela. Ali, separar removeria acesso; a consolidacao
-- correta e fundir a condicao na politica de leitura.
--
-- Verificado depois de aplicar assumindo o papel `authenticated` com o JWT de
-- cada pessoa: gestor continua vendo os mesmos 2 quadros, 4 membros, 7 areas,
-- 54 demandas, 12 solicitacoes e 20 sessoes; colaborador sem quadro continua
-- vendo zero em quadros, membros e sessoes.
--
-- Uma diferenca deliberada: "Gestores podem ver tudo" usava
-- EXISTS(colaboradores where role='gestor') sem checar `ativo`, e passou a usar
-- auth_role(), que checa. E mais restritivo — gestor inativo perde o acesso
-- amplo — e alinha a tabela com o padrao do resto do esquema. Nenhum
-- colaborador inativo existe hoje, entao ninguem e afetado agora.

-- --------------------------------------------------------------- grupo 1
drop policy if exists areas_write_gestor on public.areas;
create policy areas_insert_gestor on public.areas for insert with check ((select auth_role()) = 'gestor');
create policy areas_update_gestor on public.areas for update using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
create policy areas_delete_gestor on public.areas for delete using ((select auth_role()) = 'gestor');

drop policy if exists demandas_write_gestor on public.demandas;
create policy demandas_insert_gestor on public.demandas for insert with check ((select auth_role()) = 'gestor');
create policy demandas_update_gestor on public.demandas for update using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
create policy demandas_delete_gestor on public.demandas for delete using ((select auth_role()) = 'gestor');

drop policy if exists formularios_write_membro on public.formularios;
create policy formularios_insert_membro on public.formularios for insert with check (is_quadro_membro(quadro_id));
create policy formularios_update_membro on public.formularios for update using (is_quadro_membro(quadro_id)) with check (is_quadro_membro(quadro_id));
create policy formularios_delete_membro on public.formularios for delete using (is_quadro_membro(quadro_id));

drop policy if exists formularios_campos_write_membro on public.formularios_campos;
create policy formularios_campos_insert_membro on public.formularios_campos for insert
  with check (exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id)));
create policy formularios_campos_update_membro on public.formularios_campos for update
  using (exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id)))
  with check (exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id)));
create policy formularios_campos_delete_membro on public.formularios_campos for delete
  using (exists (select 1 from formularios f where f.id = formularios_campos.formulario_id and is_quadro_membro(f.quadro_id)));

-- --------------------------------------------------------------- grupo 2
alter policy quadros_select_membro on public.quadros
  using (is_quadro_membro(id) or (select auth_role()) = 'gestor');
drop policy if exists quadros_write_gestor on public.quadros;
create policy quadros_insert_gestor on public.quadros for insert with check ((select auth_role()) = 'gestor');
create policy quadros_update_gestor on public.quadros for update using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
create policy quadros_delete_gestor on public.quadros for delete using ((select auth_role()) = 'gestor');

alter policy quadros_membros_select on public.quadros_membros
  using (is_quadro_membro(quadro_id) or (select auth_role()) = 'gestor');
drop policy if exists quadros_membros_write_gestor on public.quadros_membros;
create policy quadros_membros_insert_gestor on public.quadros_membros for insert with check ((select auth_role()) = 'gestor');
create policy quadros_membros_update_gestor on public.quadros_membros for update using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
create policy quadros_membros_delete_gestor on public.quadros_membros for delete using ((select auth_role()) = 'gestor');

alter policy cartoes_sessoes_tempo_select_membro on public.cartoes_sessoes_tempo
  using (
    exists (select 1 from cartoes c join colunas col on col.id = c.coluna_id
            where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id))
    or colaborador_id = (select auth.uid())
    or (select auth_role()) = 'gestor'
  );
drop policy if exists cartoes_sessoes_tempo_write_own on public.cartoes_sessoes_tempo;
create policy cartoes_sessoes_tempo_insert_own on public.cartoes_sessoes_tempo for insert
  with check (((colaborador_id = (select auth.uid())) or (select auth_role()) = 'gestor')
    and exists (select 1 from cartoes c join colunas col on col.id = c.coluna_id
                where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id)));
create policy cartoes_sessoes_tempo_update_own on public.cartoes_sessoes_tempo for update
  using ((colaborador_id = (select auth.uid())) or (select auth_role()) = 'gestor')
  with check (((colaborador_id = (select auth.uid())) or (select auth_role()) = 'gestor')
    and exists (select 1 from cartoes c join colunas col on col.id = c.coluna_id
                where c.id = cartoes_sessoes_tempo.cartao_id and is_quadro_membro(col.quadro_id)));
create policy cartoes_sessoes_tempo_delete_own on public.cartoes_sessoes_tempo for delete
  using ((colaborador_id = (select auth.uid())) or (select auth_role()) = 'gestor');

drop policy if exists "Gestores podem ver tudo" on public.solicitacoes_demandas;
alter policy "Colaboradores podem ver as proprias solicitacoes" on public.solicitacoes_demandas
  using (colaborador_id = (select auth.uid()) or (select auth_role()) = 'gestor');
alter policy "Colaboradores podem criar solicitacoes pendentes" on public.solicitacoes_demandas
  with check ((colaborador_id = (select auth.uid()) and status = 'PENDENTE'::status_solicitacao)
              or (select auth_role()) = 'gestor');
alter policy solicitacoes_delete_own_pendente on public.solicitacoes_demandas
  using ((colaborador_id = (select auth.uid()) and status = 'PENDENTE'::status_solicitacao)
         or (select auth_role()) = 'gestor');
create policy solicitacoes_update_gestor on public.solicitacoes_demandas for update
  using ((select auth_role()) = 'gestor') with check ((select auth_role()) = 'gestor');
