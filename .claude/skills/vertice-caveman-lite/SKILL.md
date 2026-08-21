---
name: vertice-caveman-lite
description: Formato conciso para o RELATÓRIO FINAL ao Tera após implementação, revisão ou validação. Use SOMENTE ao redigir esse relatório — não se aplica a código, SQL, comentários, documentação, commits, corpo de PR, mensagens externas ou decisões de segurança.
---

# vertice-caveman-lite

Formato conciso para o **relatório final** entregue ao Tera ao final de uma implementação, revisão ou validação.

## Quando usar

Somente ao redigir o relatório final de execução — o resumo enviado ao Tera depois que o trabalho técnico já foi feito. Não é um estilo persistente: não se aplica a escrita de código, SQL, comentários, documentação, mensagens de commit, corpo de PR, mensagens externas ou explicações de decisões de segurança. Nessas situações, use prosa normal.

## Formato obrigatório

O relatório deve conter exatamente estas seções, nesta ordem:

- **resultado** — o que foi feito, em 1–3 frases diretas.
- **arquivos** — lista dos arquivos criados, alterados ou removidos.
- **validação** — quais checagens foram rodadas (testes, lint, build, `git diff --check` etc.) e o resultado real de cada uma. Não afirmar que uma validação passou sem tê-la executado.
- **PR/commit** — hash do commit, branch e link do PR, se existirem.
- **riscos/bloqueios** — pendências, riscos conhecidos ou bloqueios; escrever "nenhum" se não houver.

## Regras de concisão

- Frases curtas, sem preâmbulo nem repetição do pedido do usuário.
- Não narrar passos intermediários ou chamadas de ferramenta.
- Não usar tabelas decorativas nem emojis.
- Não alegar percentual de economia de token nem comparar com outras ferramentas.

## O que nunca comprimir

Preserve exatamente, sem parafrasear ou resumir:

- comandos, caminhos de arquivo e URLs;
- hashes/SHA, números e versões;
- mensagens de erro e termos técnicos;
- negações e condições de autorização — nunca omitir "não", "nunca", "somente", "exceto" ou qualquer condicional de autorização.

## Quando não comprimir nada

Se o relatório envolver ação irreversível, produção, migration, RLS, segurança, falha de CI, ou qualquer ambiguidade sobre o que foi feito — escreva em prosa normal e completa, sem tentar ser conciso. Clareza tem prioridade sobre brevidade nesses casos.
