-- convites tinha SÓ a política restritiva convites_gestor_da_org (Fase 1) e
-- nenhuma permissiva. Em Postgres, RESTRICTIVE não concede acesso — ela é
-- AND-ada sobre o que as PERMISSIVE já permitiram; sem nenhuma permissiva o
-- resultado é deny-all. Efeito prático: a tabela estava inacessível para o
-- gestor desde que foi criada, e o fluxo de convite não poderia funcionar
-- pelo app nem depois de a UI existir.
--
-- Verificado antes de escrever esta migration: inserindo um convite com
-- service role e lendo em seguida numa sessão simulada de gestor real
-- (set local role authenticated + request.jwt.claims), a contagem vista
-- pelo gestor era 0 enquanto a do service role era 1.
--
-- A permissiva concede ao gestor; a restritiva já existente continua
-- aplicando o eixo de organização por cima (AND). É o mesmo par
-- permissiva-de-papel + restritiva-de-organização das outras 43 tabelas —
-- convites era a exceção acidental.
--
-- Conferido depois de aplicar, com três sessões simuladas:
--   gestor da Teralabs .............. vê 1
--   colaborador comum da mesma org .. vê 0  (papel)
--   gestor de outra organização ..... vê 0  (eixo)
create policy "convites_gestor" on public.convites
  for all
  to authenticated
  using (public.auth_role() = 'gestor')
  with check (public.auth_role() = 'gestor');
