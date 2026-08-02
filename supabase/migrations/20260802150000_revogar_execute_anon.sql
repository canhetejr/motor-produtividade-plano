-- advisor anon_security_definer_function_executable: 18 -> 3.
--
-- 16 funcoes SECURITY DEFINER vinham com EXECUTE concedido a `anon` por padrao,
-- expostas em /rest/v1/rpc/. Nao havia brecha aberta: auditei os corpos e cada
-- uma se defende por dentro (`if not auth_is_admin() then raise`,
-- `if auth.uid() is null then raise`, `where aprovador_id = auth.uid()`). O
-- risco era a proxima funcao esquecer a guarda e ninguem perceber, porque o
-- EXECUTE ja vinha concedido. Isto fecha a porta por padrao.
--
-- A revogacao NAO e uniforme, e revogar tudo quebraria a rota publica:
--
--  * Gatilhos: revogados de PUBLIC. `revoke ... from anon` nao basta — toda
--    funcao recebe EXECUTE de PUBLIC por padrao, e era isso que os mantinha
--    acessiveis. O gatilho continua disparando: roda com os direitos do dono da
--    tabela, nao de quem fez o INSERT. Verificado com um insert em transacao
--    revertida — o codigo do cartao foi gerado normalmente.
--  * As 10 RPC do app: revogadas so de `anon`. Sao chamadas apenas em contexto
--    autenticado (confirmado por grep de `.rpc(` no codigo) e a rota publica de
--    formulario nao chama nenhuma.
--  * is_quadro_membro FICA executavel por anon: a politica
--    formularios_select_publico e `(ativo = true) OR is_quadro_membro(...)`, e o
--    Postgres nao garante curto-circuito no OR. Sem o EXECUTE o formulario
--    publico passaria a dar erro em vez de abrir.
--  * auth_role e auth_is_admin ficam: nao aparecem em politica de tabela que o
--    anonimo alcanca, e retornam null para ele.
--
-- Os 13 avisos de `authenticated_security_definer_function_executable` que
-- restam sao por desenho: sao exatamente as RPC que o app chama logado, e a
-- autorizacao delas esta no corpo. Revoga-las quebraria o produto.

revoke execute on function public.cartoes_notificar_responsavel() from public, anon, authenticated;
revoke execute on function public.colaboradores_proteger_admin() from public, anon, authenticated;
revoke execute on function public.gerar_codigo_cartao() from public, anon, authenticated;

revoke execute on function public.aprovar_cartao(uuid) from anon;
revoke execute on function public.aprovar_solicitacao(uuid) from anon;
revoke execute on function public.atualizar_apontamento(uuid, uuid, numeric, integer, text, text) from anon;
revoke execute on function public.avancar_sequencia_cartao(uuid) from anon;
revoke execute on function public.definir_admin(uuid, boolean) from anon;
revoke execute on function public.registrar_apontamento(uuid, numeric, integer, text, text) from anon;
revoke execute on function public.registrar_apontamento_timer(uuid, date, integer) from anon;
revoke execute on function public.rejeitar_cartao(uuid, text) from anon;
revoke execute on function public.rejeitar_solicitacao(uuid) from anon;
revoke execute on function public.solicitar_aprovacao_cartao(uuid, uuid) from anon;
