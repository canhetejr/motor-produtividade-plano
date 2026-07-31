-- =====================================================================
-- Formulário público: título e descrição do card por MODELO com variáveis.
--
-- Hoje o card nasce com o texto que o código monta: o título é a resposta
-- do campo marcado como "titulo" e a descrição é sempre a lista
-- "Rótulo: resposta" precedida de "Enviado via formulário X". Não dá para
-- combinar duas respostas num título ("Suporte — {{setor}}"), nem tirar o
-- cabeçalho, nem escrever qualquer frase própria.
--
-- Estas duas colunas guardam o modelo escrito no builder, com tokens
-- {{chave}} resolvidos na submissão (lib/variaveis.ts). São NULL por
-- padrão de propósito: null = "sem modelo" e mantém exatamente o
-- comportamento anterior, então nenhum formulário já criado muda de
-- resultado por causa desta migration.
-- =====================================================================

begin;

alter table formularios add column if not exists titulo_template text;
alter table formularios add column if not exists descricao_template text;

comment on column formularios.titulo_template is
  'Modelo do título do card, com variáveis {{chave}} das respostas. Null = usa o campo mapeado como título.';
comment on column formularios.descricao_template is
  'Modelo da descrição do card, com variáveis {{chave}}. Null = lista automática com todas as respostas.';

commit;
