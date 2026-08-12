# Checklist — ambiente Supabase de integração do MCP

Para marcar enquanto executa. O raciocínio está em
[`PLANO-MCP-PRODUTO.md`](./PLANO-MCP-PRODUTO.md), Passo 0 — aqui é só a
sequência, para quem tem acesso à organização Supabase e ao repositório
GitHub da Tera. Nenhum passo aqui é executado pelo Claude Code sozinho: cria
projeto com custo, emite chave de service role e mexe em secrets do GitHub.

**Pré-requisito:** acesso de owner/admin na organização Supabase da Tera e
permissão de administrador em `canhetejr/vertice` no GitHub (para cadastrar
secrets).

---

## 0. Antes de tudo — o que nunca fazer

- [ ] **Nunca** usar o projeto de produção `bapufbypqmtjtujfbiai` ("Motor
      Produtividade") como banco de integração — nem para testar rápido, nem
      "só dessa vez". É o banco com dado real da empresa em produção.
- [ ] **Nunca** colar o valor de um secret em um commit, PR, issue, log de
      workflow ou mensagem de chat — nem para "confirmar que copiou certo".
- [ ] **Nunca** usar a chave `anon`/`publishable` no lugar da `service_role` —
      o MCP precisa do bypass de RLS explícito descrito em `lib/mcp-auth.ts`.

---

## 1. Criar o projeto Supabase de integração

- [ ] Criar um projeto novo, **separado do de produção**, com nome que deixe
      o propósito óbvio no dashboard (sugestão: `vertice-mcp-integracao`).
- [ ] Anotar o **project ref** (o identificador na URL do projeto, ex.
      `abcdefghijklmnop`) e a **URL da API** (`https://<ref>.supabase.co`) em
      um lugar seguro — não em texto plano num arquivo do repositório.
- [ ] Confirmar visualmente, no dashboard, que o projeto aberto é o novo
      (nome/ref conferem) antes de prosseguir para os passos seguintes. Um
      projeto errado selecionado por engano é o erro mais fácil de cometer
      aqui.

## 2. Aplicar as migrations em ordem

- [ ] Conferir a contagem atual em vez de confiar em qualquer número escrito
      em `docs/`: `ls supabase/migrations | wc -l`.
- [ ] Aplicar os arquivos de `supabase/migrations/` **em ordem lexicográfica
      de nome** (o timestamp no início do nome é a ordem de execução), do
      primeiro ao último — via Supabase CLI (`supabase db push` apontando
      para o projeto novo) ou aplicando cada arquivo manualmente pelo SQL
      Editor do dashboard, um de cada vez, na ordem.
- [ ] **Nunca** usar `supabase/schema.sql` como atalho: é um retrato antigo,
      anterior ao multi-inquilino, e sobe um banco sem o eixo de organização.
- [ ] Se qualquer migration falhar, parar e investigar antes de continuar —
      não pular um arquivo com erro e seguir para o próximo.

## 3. Regenerar e conferir `lib/database.types.ts`

- [ ] Gerar os tipos a partir do schema recém-aplicado nesse projeto (CLI:
      `supabase gen types typescript --project-id <ref> --schema public`, ou
      a ferramenta equivalente de geração de tipos do Supabase).
- [ ] Comparar o resultado com o `lib/database.types.ts` já versionado no
      repositório: a forma (tabelas, colunas, tipos) deve **bater**. Qualquer
      diferença aponta para uma migration aplicada fora de ordem ou ausente
      no passo 2 — voltar lá, não editar o arquivo gerado à mão para
      "corrigir" a diferença.
- [ ] Este passo é só uma conferência de paridade de schema — não commitar
      no repositório um `database.types.ts` gerado a partir do projeto de
      integração.

## 4. Verificar os advisors

- [ ] Dashboard do projeto de integração → **Advisors → Security**: revisar
      cada aviso. Tabela sem RLS ou política ausente aqui reproduz o mesmo
      problema que existiria em produção.
- [ ] Dashboard → **Advisors → Performance**: revisar. Avisos de "índice sem
      uso" são esperados num projeto que ainda não recebeu tráfego real — não
      é sinal de problema, é o mesmo padrão já observado em produção para
      `mcp_tokens` logo após a migration inicial.
- [ ] Registrar (neste checklist ou em anotação própria) qualquer aviso que
      não seja o de "índice sem uso por falta de tráfego" antes de liberar o
      projeto para uso — não seguir para o passo 5 com um aviso de segurança
      não explicado.

## 5. Cadastrar os secrets no GitHub Actions

- [ ] No repositório `canhetejr/vertice`: **Settings → Secrets and variables
      → Actions → Secrets → New repository secret**.
- [ ] Criar dois secrets, com estes nomes **exatos** (são os que
      `.github/workflows/mcp-integracao.yml` espera):
      - `MCP_INTEGRATION_SUPABASE_URL` → URL da API do projeto de integração
        (passo 1).
      - `MCP_INTEGRATION_SERVICE_ROLE_KEY` → chave `service_role` desse
        mesmo projeto (Dashboard → Project Settings → API).
- [ ] Usar a aba **Secrets**, nunca **Variables** — secrets são mascarados
      nos logs do Actions, variables não.
- [ ] Depois de salvar, o GitHub não mostra mais o valor. Se precisar
      conferir, é preciso **substituir** o secret, não há como "ver de novo".
- [ ] Confirmar que nenhum dos dois valores foi colado em qualquer outro
      lugar durante o processo (histórico do navegador com autofill,
      clipboard manager, notas) além do cadastro em si.

## 6. Disparar o workflow manualmente e conferir o resultado esperado

- [ ] GitHub → aba **Actions** → workflow **"MCP — suíte de isolamento
      (integração)"** → **Run workflow** → escolher a branch → rodar.
- [ ] Com os dois secrets do passo 5 já cadastrados, esperado:
      - `checkout`, `setup-node` e `npm ci` verdes;
      - passo **"Verificar credenciais do banco de integração"** verde, sem
        erro;
      - passo final (`npm test -- __tests__/isolamento`) roda de fato contra
        o banco novo. Hoje, antes do Gate 1 existir, isso cobre
        `admin-client-estatico.test.ts` (sempre passa, não usa banco) e a
        parte de `mcp-tokens.test.ts`/`catalogo-eixo.test.ts` que depende de
        `SUPABASE_SERVICE_ROLE_KEY` — o resultado dessas é o primeiro sinal
        real de que o schema do projeto de integração está correto.
- [ ] Se algum teste desse grupo falhar por schema ausente/diferente, é sinal
      de que o passo 2 (migrations) ficou incompleto — não é falha do
      workflow em si.

## 7. Confirmar que o workflow falha corretamente sem os secrets

- [ ] Melhor momento para este teste: **antes** de cadastrar os secrets do
      passo 5 — ou seja, pode ser feito primeiro, como linha de base, antes
      do passo 6. Se os secrets já foram cadastrados e for preciso
      reconfirmar depois, é possível repetir disparando o workflow numa
      branch em que os secrets não se apliquem, sem apagar os secrets do
      repositório.
- [ ] Disparar o workflow (**Run workflow**) num estado sem os dois secrets
      presentes.
- [ ] Esperado: o job para no passo **"Verificar credenciais do banco de
      integração"**, com uma anotação de erro (`::error::`) citando os dois
      nomes de secret ausentes e apontando para o Passo 0 deste plano — **não
      pula a etapa, não fica cinza, falha em vermelho**.
- [ ] Se o job passar (verde) sem os secrets configurados, o workflow está
      quebrado — parar e revisar `.github/workflows/mcp-integracao.yml` antes
      de confiar em qualquer execução dele.

## 8. Cuidados permanentes para nunca usar produção por engano

- [ ] Antes de colar qualquer URL/chave nos secrets do passo 5, comparar o
      project ref com `bapufbypqmtjtujfbiai` — se bater, **parar**, é o
      projeto errado.
- [ ] Manter o nome do projeto de integração (passo 1) sempre distinto e
      óbvio no dashboard do Supabase, especialmente se mais projetos forem
      criados no futuro (ex. staging, conforme `CHECKLIST-MIGRACAO.md`).
- [ ] Se em algum momento houver suspeita de que a chave `service_role` do
      projeto de integração vazou ou foi trocada pela de produção por
      engano, revogar/rotacionar imediatamente (ver Passo 0, item 0.2.5 do
      plano) — não esperar o próximo ciclo programado de rotação.
- [ ] Este checklist não substitui a leitura do Passo 0 completo em
      `PLANO-MCP-PRODUTO.md` antes de a primeira vez rodar qualquer passo
      aqui.
