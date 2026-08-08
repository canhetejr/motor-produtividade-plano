-- Achado ao investigar por que o cadastro público falhava para a segunda
-- organização em diante: areas_nome_key era UNIQUE(nome) GLOBAL, sobrevivente
-- de antes da Fase 2 (quando só existia uma empresa). criar_organizacao()
-- sempre cria uma área "Geral" — a segunda organização a se cadastrar
-- colide com a primeira. Mesmo padrão achado em mais duas tabelas por
-- auditoria de todas as constraints UNIQUE das 43 tabelas do eixo que não
-- mencionam organizacao_id (a maioria já está corretamente escopada de
-- forma transitiva via quadro_id/cartao_id/area_id, que por sua vez são
-- únicos por organização — só estas três precisavam de correção direta):
--
-- - areas.nome: toda organização nova tenta criar "Geral" e colide com
--   qualquer área de mesmo nome já existente em QUALQUER empresa.
-- - quadros.codigo: prefixo curto escolhido por quem cria o quadro (usado
--   em tr_gerar_codigo_cartao) — nomes óbvios como "TST"/"GERAL" colidem
--   entre empresas diferentes.
-- - relatorios_agendados.nome: mesmo problema, nome de relatório escolhido
--   pelo usuário.
--
-- formularios.slug, quadros_compartilhamentos.token e convites.token_hash
-- ficam de fora de propósito: são identificadores de URL pública
-- (/formularios/[slug], /q/[token], /convite/[token]) e PRECISAM ser únicos
-- no namespace inteiro, não por organização.

alter table public.areas drop constraint areas_nome_key;
alter table public.areas add constraint areas_organizacao_id_nome_key unique (organizacao_id, nome);

alter table public.quadros drop constraint quadros_codigo_key;
alter table public.quadros add constraint quadros_organizacao_id_codigo_key unique (organizacao_id, codigo);

alter table public.relatorios_agendados drop constraint relatorios_agendados_nome_unico;
alter table public.relatorios_agendados add constraint relatorios_agendados_organizacao_id_nome_key unique (organizacao_id, nome);
