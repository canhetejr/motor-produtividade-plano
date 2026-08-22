# Fluxo de changelog de release

O Vértice permanece em **Beta**. Toda entrega promovida a `main` precisa mostrar a versão e a nota correspondente na Central de ajuda (`/documentacao`) no mesmo release.

## Fluxo obrigatório

1. Trabalhe normalmente em uma branch `feat/*`, `fix/*`, `docs/*` ou `ci/*` e integre em `develop`.
2. Antes da promoção `develop → main`, acrescente uma nova entrada no início de `lib/changelog.ts`:
   - `id` único e descritivo;
   - `versao` no formato `0.x.y` enquanto o produto estiver em Beta;
   - `publico: 'equipe'` para quem usa o produto e/ou `publico: 'gestao'` para impactos administrativos, técnicos, segurança ou operação;
   - data, título, resumo, categorias e itens que expliquem o efeito real da entrega.
3. A mesma PR deve atualizar a versão exibida: `VERSAO_ATUAL` sempre deriva da primeira entrada do changelog.
4. Abra a promoção para `main`. O workflow **Changelog de release** bloqueia a PR se houver alteração de conteúdo sem mudança em `lib/changelog.ts`.
5. Depois da CI obrigatória, faça o merge por **merge commit** e valide o deploy do Coolify.

## Exceção

PRs de reconciliação de ancestry sem diferença de arquivos não são releases e passam sem nova nota.

## Critério de escrita

Escreva para a pessoa afetada pela mudança, não para o histórico de implementação. Evite chamar o produto de estável: use **Beta** até uma decisão explícita de saída da fase beta.
