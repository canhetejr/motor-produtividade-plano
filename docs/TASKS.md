# TASKS — Motor de Produtividade

Checklist sequencial. Cada fase depende da anterior estar funcional. Marcar `[x]` ao concluir.
Detalhes de cada decisão estão em `PLANO.md`.

## Fase 1 — Fundação

- [x] `create-next-app` (TypeScript, App Router, Tailwind) na raiz do repo
- [x] Instalar e configurar shadcn/ui
- [x] Criar projeto Supabase (ou conectar a um existente) e rodar `supabase/schema.sql`
- [x] Rodar `supabase/seed.sql` (catálogo já mapeado, ver seção abaixo)
- [ ] Configurar RLS conforme `PLANO.md` seção 2
- [ ] Auth Supabase — magic link (ver decisão em aberto no PLANO.md antes de fechar)
- [ ] Middleware de sessão / proteção de rotas por `role` (`colaborador` vs `gestor`)
- [x] `.env.local` a partir do `.env.example`, testar conexão local

## Fase 2 — Apontamento (tela crítica)

- [x] `/apontamento` — formulário: demanda (select), quantidade (default 1), tempo manual
      (só aparece se demanda for `variavel`), observações
- [x] Otimizar pra mobile — testar em viewport de celular antes de dar por concluída
- [x] `/apontamento/historico` — listagem dos últimos apontamentos do próprio colaborador,
      com edição/exclusão do dia atual
- [ ] Validar que RLS bloqueia colaborador de editar apontamento de outra pessoa

## Fase 3 — Dashboard

- [x] `/dashboard` — tabela colaborador x índice de produtividade (usa a view
      `indicadores_diarios`), com farol verde/amarelo/vermelho
- [x] Filtro por período (dia / semana / mês) e por área
- [x] `/dashboard/[colaborador]` — série histórica em gráfico (Recharts)
- [x] Confirmar que só `role = gestor` acessa essas rotas

## Fase 4 — Admin do catálogo

- [x] `/catalogo` — CRUD de áreas e demandas (cadastrar nova demanda, editar tempo padrão,
      marcar `variavel`)
- [x] `/colaboradores` — CRUD de colaboradores, carga horária, área, ativo/inativo
- [x] `/relatorios` — export do período selecionado em CSV

## Fase 5 — Automação (Vercel Cron)

- [ ] Configurar `vercel.json` com os 3 crons (lembrete, alerta, relatório — horários em
      `PLANO.md` seção 4)
- [ ] `app/api/cron/lembrete-diario` — checar `CRON_SECRET`, consultar quem não apontou hoje,
      enviar e-mail via Resend
- [ ] `app/api/cron/alerta-queda` — índice < 70% por 2 dias seguidos → e-mail pro gestor
- [ ] `app/api/cron/relatorio-semanal` — resumo semanal por área/colaborador
- [ ] Testar cada rota manualmente (com o header correto) antes de confiar no cron

## Fase 6 — Deploy

- [ ] Deploy na Vercel, plano compatível com uso institucional (ver PLANO.md)
- [ ] Apontar `mp.unicive.cloud` (CNAME) e validar SSL
- [ ] Revisão final de RLS com dados reais antes de liberar pro time
- [ ] Confirmar que as 3 demandas pendentes (Estágio, Intercorrência, ICode) foram definidas
      ou seguem sinalizadas como pendente — não travar o lançamento por causa disso

---

## Seed do catálogo (Fase 1)

Usar exatamente os dados já validados na planilha — não inventar tempos novos. Ver
`supabase/seed.sql`. As únicas demandas sem `tempo_padrao_min` são Estágio, Intercorrência e
ICode (Área Moodle) — isso é esperado, não corrigir "adivinhando" um valor.
