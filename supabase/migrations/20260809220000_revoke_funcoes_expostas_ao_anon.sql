-- Higiene da superfície pública: funções SECURITY DEFINER que o PostgREST
-- expõe em /rest/v1/rpc/ para o papel `anon` sem que nenhum caminho anônimo
-- precise delas.
--
-- Nenhuma delas é um furo hoje — aprovar/rejeitar_correcao_apontamento
-- começam por `if auth_role() <> 'gestor' then raise` e filtram tudo por
-- org_atual(), e trg_assentos_verificar() é função de trigger (chamada direto
-- ela falha). Isto é defesa em profundidade.
--
-- ATENÇÃO ao motivo de `from public` e não `from anon`: no Postgres, toda
-- função nasce com EXECUTE concedido a PUBLIC. `revoke ... from anon` não
-- remove nada, porque a permissão do anon não vem de um grant nominal a ele —
-- vem de PUBLIC, que ele herda. O revoke roda sem erro e sem efeito, e
-- has_function_privilege('anon', ...) continua true. Só `from public` corta.
--
-- Como isso derruba authenticated junto, os papéis que o app realmente usa
-- são regrantados nominalmente logo abaixo.
--
-- O que NÃO é tocado, de propósito: auth_role() e is_quadro_membro(). São
-- maquinário das próprias políticas — toda policy do schema é `to public` e as
-- invoca, e o papel precisa de EXECUTE para a expressão ser avaliada. Sem
-- elas, leitura anônima trocaria "zero linhas" por "permission denied". Também
-- não vazam nada: devolvem o papel de quem chama, e para anon isso é nulo.

begin;

-- Aprovação de correção de apontamento: só gestor, e o app chama como
-- authenticated (app/(app)/apontamento/actions-correcoes.ts).
revoke execute on function public.aprovar_correcao_apontamento(uuid) from public;
revoke execute on function public.rejeitar_correcao_apontamento(uuid, text) from public;
grant execute on function public.aprovar_correcao_apontamento(uuid) to authenticated;
grant execute on function public.rejeitar_correcao_apontamento(uuid, text) to authenticated;

-- auth_is_admin(): não é usada por nenhuma política nem chamada por RPC no
-- app (o guard de admin lê o perfil). Fica só para service_role.
revoke execute on function public.auth_is_admin() from public;

-- Função de trigger: não deve ser chamável por ninguém pela API. O trigger a
-- executa pelo mecanismo do Postgres, que não consulta EXECUTE do usuário —
-- então tirar de todo mundo não afeta a verificação de assentos.
revoke execute on function public.trg_assentos_verificar() from public;

commit;
