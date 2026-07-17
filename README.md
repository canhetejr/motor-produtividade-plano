# Motor de Produtividade

Plano completo pronto pro `agy` (Antigravity CLI) construir o app. Este repositório ainda não
tem código — é o pacote de planejamento + configuração inicial.

## Ordem de leitura pro agy

1. `AGENTS.md` — regras do projeto (lido automaticamente pelo agy a cada prompt)
2. `docs/PLANO.md` — spec técnica completa (stack, modelo de dados, rotas, automação, fases)
3. `docs/TASKS.md` — checklist sequencial por fase

## Como rodar

```bash
cd motor-produtividade-plano
agy
```

Dentro do TUI, algo como:

```
> Leia AGENTS.md, docs/PLANO.md e docs/TASKS.md. Comece pela Fase 1 do TASKS.md.
```

## O que já vem pronto neste pacote

- `supabase/schema.sql` — schema completo (tabelas, views, RLS)
- `supabase/seed.sql` — catálogo de demandas já validado (39 registros, com as 3 pendências
  de tempo padrão sinalizadas como `null` de propósito)
- `vercel.json` — os 3 crons já configurados nos horários certos
- `.env.example` — todas as variáveis que o projeto vai precisar
- `.gitignore` — padrão Next.js

## O que falta decidir antes/durante a Fase 1

Ver "Pontos em aberto" no final de `docs/PLANO.md`: magic link vs senha no login, teto de
tempo pro "Outros", plano da Vercel pra produção.
