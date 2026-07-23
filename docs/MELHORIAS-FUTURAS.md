# Melhorias futuras — backlog de ideias

Sugestões levantadas em revisões do projeto, ainda não priorizadas nem planejadas em
detalhe. Cada item aqui é uma ideia a discutir quando chegar a vez, não um compromisso.

## Testes automatizados

Zero cobertura de teste hoje. O bug da view `apontamentos_calculado` (coluna nova em
`apontamentos` não propagava pra view criada com `select a.*`) é exatamente o tipo de
coisa que um teste de integração simples pegaria antes de virar erro em produção. Não
precisa ser cobertura completa — os cálculos de índice (`lib/dates.ts`, a divisão de
`tempo_total_min`/`carga_horaria_min`) e o fluxo de apontamento/aprovação já cobririam o
que mais quebra.

## Trilha de auditoria

Mudança de carga horária, desativação de colaborador, aprovação/rejeição de demanda —
nada disso fica registrado com "quem fez e quando" além da notificação (que é pro
destinatário, não um log de auditoria). Pra decisões da diretoria, ter esse rastro pode
importar. Precisaria de uma tabela `auditoria`/`eventos` populada nas Server Actions que já
fazem essas mudanças.

## Progresso do dia na tela de apontamento

Colaborador só vê o próprio progresso do dia de forma indireta (heatmap); uma barra
"X% da meta de hoje" bem visível ali mesmo, enquanto lança, dá feedback imediato sem
precisar abrir o dashboard (que é exclusivo do gestor).

## Outras ideias menores (não detalhadas ainda)

- Import em massa (CSV) de colaboradores/demandas, se a equipe crescer.
- PWA (manifest + service worker) já que `/apontamento` é mobile-first e usado no dia a
  dia — instalar na tela inicial do celular.
- Confirmação (AlertDialog) antes de rejeitar uma solicitação, igual já existe pra excluir
  apontamento — hoje aprovar/rejeitar disparam direto no clique.
- Editar apontamento (hoje só existe excluir + relançar; ficou fora do MVP de propósito,
  ver `docs/TASKS.md`).
