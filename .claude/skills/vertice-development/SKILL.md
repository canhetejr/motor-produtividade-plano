---
name: vertice-development
description: Fluxo de trabalho profissional do Vértice — worktree/branch, papéis entre Luiz, Claude e Tera, os gates que uma mudança precisa passar antes de virar PR, e por que staging não é ambiente seguro para escrita. Use SEMPRE que for começar uma tarefa nova neste repositório, criar branch, abrir PR, decidir se algo pode ir para staging ou produção, ou avaliar se uma mudança está pronta. Use também quando o pedido envolver "fazer deploy", "subir para produção", "testar em staging" ou "abrir PR".
---

# Fluxo de trabalho do Vértice

O Vértice está em **Beta** — trate qualquer alteração como algo que toca produto real, com dado de cliente real, nunca como "é só staging, tanto faz".

## Papéis

- **Luiz** aprova objetivo, escopo, migrations e publicação. Mudança de escopo, DDL destrutivo ou qualquer coisa que toque produção passa por ele antes, não depois.
- **Claude** implementa em worktree/branch isolada e prepara o PR para `develop`. Implementar não inclui promover, fazer merge ou publicar.
- **Tera** investiga, supervisiona, revisa independentemente, valida CI e controla a promoção/deploy. É quem decide se o que está pronto em `develop` vai para `main`.

Nenhum desses papéis se substitui: Claude não aprova o próprio trabalho, e "os testes passaram no meu terminal" não é a mesma coisa que revisão independente.

## Branch e PR

`feat/*` | `fix/*` | `docs/*` → PR para `develop` → `main`. `master` é histórico, não é branch de trabalho — nunca abra PR contra ela nem parta dela para trabalho novo.

Trabalhe em worktree isolada por tarefa. Antes de qualquer comando que possa descartar trabalho não commitado (`checkout`, `restore`, `reset`, `clean`), rode `git status`.

## Onde é seguro escrever

**Produção e staging hoje compartilham o mesmo Supabase/Auth/Storage/credenciais/integrações.** Isso muda o que "testar em staging" pode significar:

- Staging (`develop` → `https://dev.vertice.teralabs.cloud`) serve para validar que o código builda, roteia e renderiza — nunca para migration, teste mutável, fixture, upload, e-mail, fluxo Google ou qualquer escrita. Uma escrita "só para testar" em staging é uma escrita em produção.
- O único alvo autorizado para teste destrutivo é o projeto Supabase isolado de integração `khaeknegymhygsdofkce`.
- Produção mantém exatamente 7 crons (`lib/admin-saude.ts`); staging tem 0. Não crie *Scheduled Task* equivalente em staging — não há para onde ela apontar com segurança.

Se uma tarefa parece exigir escrita em staging para ser validada, o problema é o plano de teste, não uma exceção a essa regra — pare e leve para Luiz.

## Gates antes de qualquer PR

Nesta ordem, e todos precisam passar de verdade, não só "provavelmente passariam":

1. `npm test`
2. `npm run lint`
3. `npm run build`
4. `git diff --check` (sem conflito residual, sem whitespace inválido)

**CI e estado live são prova, não relato do agente.** Não escreva "os testes devem passar" ou "isso deve funcionar em produção" — rode o comando, leia a saída real, e é essa saída (ou o resultado do CI/deploy do Coolify) que sustenta a afirmação. Se um gate não pôde ser rodado, diga isso explicitamente em vez de presumir sucesso.

## Produção

Só com autorização explícita de Luiz, e só depois que Tera validou CI e revisão em `develop`. Nenhuma tarefa de agente promove `develop` → `main`, faz merge, força push ou deploy por conta própria.
