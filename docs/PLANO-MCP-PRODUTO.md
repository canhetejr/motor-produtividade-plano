# MCP Vértice — Plano de Produto e Operação

> **Para Claude Code:** Leia este arquivo antes de alterar o MCP. Execute as etapas em ordem, começando pelo Passo 0 (fundação do ambiente de integração) — o Gate 1 não começa sem ele concluído. Depois disso, TDD estrito em cada gate. Não habilite escrita MCP enquanto o Gate 1 não estiver concluído e validado contra banco real.

**Objetivo:** Transformar o MCP do Vértice em uma integração de produto segura, observável e fácil de conectar, mantendo o lançamento atual somente leitura até existir prova real de isolamento entre organizações.

**Estado inicial confirmado (12/08/2026):**

- Produção: `https://vertice.teralabs.cloud/api/mcp` no Coolify.
- Transporte: Streamable HTTP stateless, `POST` apenas, SDK MCP `@modelcontextprotocol/sdk@1.30.0`.
- Autorização: token pessoal Bearer, hash SHA-256 no banco, escopos explícitos e expiração/revogação.
- Ferramentas de leitura: `apontamentos_listar`, `demandas_minhas`, `cartoes_meus_pendentes`.
- Resources: `vertice://apontamentos/hoje`, `vertice://apontamentos/semana-atual`, `vertice://demandas/minhas`, `vertice://cartoes/meus-pendentes`.
- `createAdminClient()` fica limitado a `lib/mcp-auth.ts` e `lib/mcp/queries.ts`; o teste estático deve continuar garantindo isso.
- Não usar `SUPABASE_JWT_SECRET`, JWT HS256, impersonação de sessão, `lib/mcp-jwt.ts` nem `utils/supabase/mcp.ts`.
- Todo dado MCP deve derivar `organizacaoId` e `colaboradorId` do token resolvido; nunca aceitar esses IDs do cliente/tool.
- HTTP público já endurecido no commit `a633986`: 401 neutro, `405 Allow: POST`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, erros internos não são enviados ao cliente.

## Regras inegociáveis

1. **Escrita fica bloqueada.** Não registrar apontamento, mover/criar/editar cartão, alterar demandas, administradores, planos, assinaturas ou Console via MCP antes do Gate 1 verde.
2. Cada consulta em `lib/mcp/queries.ts` deve ter filtro explícito `organizacao_id`; leituras pessoais também devem filtrar o colaborador derivado do token.
3. Tokens e headers jamais entram em Git, logs, documentação, testes ou mensagens. `.mcp.json` segue ignorado.
4. Aplicar migrations apenas novas e estreitas; nunca reescrever uma migration já aplicada.
5. Para toda mudança comportamental: teste falhando → implementação mínima → teste verde → suíte/lint/build.
6. Não declarar o MCP “produto total” apenas porque a UI ou o endpoint respondem; os gates abaixo exigem evidência executável.

---

## Passo 0 — Fundação do ambiente de integração (bloqueia o Gate 1)

**Meta:** existir onde, com quê e por quem a suíte de integração do Gate 1 roda, antes de escrever a primeira fixture. Sem isso, "Gate 1 verde" não tem lugar para acontecer — hoje o repositório não tem `.github/workflows/` nem qualquer pipeline de CI, e o deploy é manual via Coolify.

### 0.1 Decisão de execução

1. Criar uma esteira de CI mínima dedicada à suíte de integração MCP. Escopo mínimo: um job que roda `npm test` incluindo `__tests__/isolamento/mcp-real.integration.test.ts` (a criar no Gate 1) contra o banco de teste do item 0.2.
2. Enquanto essa CI não existir e não estiver rodando de fato, **nenhum deploy que altere código de MCP pode ser tratado como "Gate 1 aprovado"** — mesmo que a suíte tenha sido rodada manualmente uma vez na máquina de alguém. Aprovação de gate exige execução repetível e registrada, não uma corrida local isolada.
3. A suíte de isolamento não pode ser pulada (`skip`, `it.skip`, ou credencial ausente tratada como "ok") no ambiente de release: se `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do banco de integração não estiverem disponíveis no job de release, o job **falha**, nunca passa em silêncio. O padrão atual de pular com aviso em `__tests__/isolamento/*.test.ts` continua válido só para desenvolvimento local, nunca para CI/release.

### 0.2 Provisionamento

1. Projeto Supabase **exclusivo de integração** — nunca o de produção (`bapufbypqmtjtujfbiai`) nem um projeto de desenvolvimento pessoal compartilhado. Nome que deixe o propósito óbvio em qualquer dashboard com múltiplos projetos (ex.: `vertice-mcp-integracao`).
2. Responsável pela criação: quem tem acesso à organização Supabase da Tera (dono do plano/billing). Criar projeto e emitir chave de service role é ação com custo e superfície de segurança — não é algo para o Claude Code executar sozinho sem confirmação explícita.
3. Processo de criação, em ordem:
   - criar o projeto vazio;
   - aplicar as migrations em `supabase/migrations/` na ordem em que existem, do início ao fim — nunca a partir de `supabase/schema.sql` (histórico, pré-multitenancy);
   - regenerar `lib/database.types.ts` a partir desse schema aplicado e conferir que bate com o tipo já versionado; qualquer diferença denuncia migration local não commitada ou fora de ordem, não algo para "ajustar" no gerado;
   - rodar `get_advisors` (ou equivalente) contra esse projeto antes de liberar para uso, mesmo padrão de qualquer migration nova (skill `vertice-migrations`).
4. Credenciais no CI: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto de integração entram como *secrets* do provedor de CI — nunca em arquivo versionado, `.env` commitado, log de job ou nome de branch/commit. Nenhum desses valores é impresso em stdout/stderr do job; modo de debug que exponha variáveis de ambiente fica desligado para este job específico.
5. Rotação: a chave de service role do projeto de integração é rotacionada sempre que alguém com acesso a ela sai do time, e revisada periodicamente (sugestão: a cada troca de trimestre, junto com qualquer outra revisão de segredo do projeto). Mesmo sendo dado só de teste, service role bypassa RLS por completo e não é uma chave "configura uma vez e esquece".

### 0.3 Job de integração

1. Gatilho: no mínimo, disparo manual sob demanda, mais execução automática antes de qualquer deploy que toque `lib/mcp*`, `app/api/mcp/**` ou `supabase/migrations/*mcp*`. Rodar em todo push é aceitável se o tempo do job permitir; não é obrigatório rodar em todo commit do repositório inteiro.
2. Variáveis exigidas: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto de integração (0.2). Ausência de qualquer uma delas falha o job com mensagem explícita — nunca pula a etapa em silêncio.
3. Comando: `npm test -- __tests__/isolamento/mcp-real.integration.test.ts` (ou o caminho final que o Gate 1 definir), isolado do restante da suíte unitária para não competir por tempo/paralelismo com testes que não tocam banco. `npm test` (suíte completa, sem banco) continua obrigatório em todo PR; o comando de integração é uma etapa adicional, não o substitui.
4. Timeout: o job de integração tem timeout próprio, curto o suficiente para pegar trava/deadlock — um valor exato fica definido quando a suíte existir e tiver tempo real medido; até lá, não deixar o timeout padrão do runner (que pode ser dezenas de minutos) mascarar um teste travado.
5. Cleanup idempotente: toda fixture usa prefixo único por execução (`mcp-it-<uuid>`, já previsto no Gate 1); o job roda cleanup em `afterAll` **e** uma varredura best-effort no início (apagar sobras de execuções anteriores que falharam antes do cleanup rodar), para que uma falha não acumule lixo que quebre a próxima execução.
6. Separação clara: testes unitários (mock de `createAdminClient`, como já existe em `__tests__/isolamento/mcp-tokens.test.ts`) continuam rodando sempre, sem banco, em qualquer `npm test` local ou de CI. Testes de integração real (Gate 1) só rodam com as credenciais do 0.2 presentes e vivem em arquivo(s) separado(s) (`*.integration.test.ts`), nunca misturados no arquivo dos testes unitários.

### 0.4 Critérios de pronto do Passo 0

O Passo 0 está concluído quando existir, de forma verificável — não apenas descrita:

1. Um job de CI que roda a suíte de integração contra o projeto Supabase de integração (0.2), falha explicitamente sem as credenciais, e cuja execução mais recente está registrada (link/log) — não uma promessa de que "vai rodar".
2. Organização A e organização B seedadas nesse banco, cada uma com dados marcadores inequívocos (nomes/códigos que não colidem e são fáceis de localizar num resultado de teste).
3. Um token MCP real para a organização A — gerado pelo fluxo normal de criação de token, nunca inserido direto no banco por fora do app — usado para provar, via tools **e** via resources (não só chamando `lib/mcp/queries.ts` direto), que nenhum marcador da organização B aparece em nenhuma resposta.
4. Prova reproduzível: rodar o job de novo (ou localmente com as mesmas credenciais) produz o mesmo resultado, e o log fica anexável para revisão — o artefato que substitui "confiar na palavra de quem rodou".

Só depois desses quatro pontos verificáveis o Gate 1 tem fundação para começar as fatias de TDD listadas abaixo.

---

## Gate 1 — Isolamento real entre organizações (bloqueia escrita)

**Meta:** provar num Supabase isolado de integração que um token da organização A não pode ler nenhum dado da organização B, mesmo usando service role por trás do MCP.

### Arquivos previstos

- Criar: `__tests__/isolamento/mcp-real.integration.test.ts`
- Criar: `__tests__/isolamento/mcp-fixtures.ts`
- Modificar: `__tests__/isolamento/README.md`
- Possivelmente criar: script seguro de setup/cleanup em `scripts/`, somente se o harness não puder ficar no teste.
- Consultar: `lib/mcp-auth.ts`, `lib/mcp/queries.ts`, `lib/mcp/tools/*.ts`, `lib/mcp/resources.ts`, `lib/database.types.ts` e migrations ordenadas em `supabase/migrations/`.

### Pré-requisitos

- Usar projeto Supabase **exclusivo de teste**, nunca `bapufbypqmtjtujfbiai` de produção.
- CI deve fornecer `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas para esse ambiente isolado.
- Fixtures devem ter prefixo único por execução (`mcp-it-<uuid>`), registrar todos os IDs criados e limpar em `afterAll` mesmo em falha.
- Não usar `supabase/schema.sql`: é histórico e pré-multitenancy. A fonte é a sequência de migrations e `lib/database.types.ts` gerado.

### TDD em fatias

1. Criar teste falhando que exige as variáveis de ambiente e falha com mensagem explícita em CI quando ausentes; localmente pode ser opt-in, mas a job de release não pode pular.
2. Criar fixture mínima da organização A: organização ativa, área, colaborador ativo, demanda, apontamento, quadro/coluna não final/cartão e responsável, token hash válido com os dois escopos.
3. Rodar o teste e confirmar RED por fixture B inexistente.
4. Criar a mesma fixture para organização B, com dados marcadores inequivocamente distintos.
5. Rodar e confirmar que cada token resolve para sua própria identidade.
6. Para token A, executar `listarApontamentos`, `listarDemandasMinhas` e `listarCartoesPendentes`; afirmar que todos os marcadores A aparecem e nenhum marcador/ID B aparece.
7. Repetir a prova pelos resources e pelo caminho HTTP/JSON-RPC, não apenas chamando queries diretamente.
8. Criar caso adversarial controlado que associe IDs/joins potencialmente confusos, quando as FKs permitirem, para comprovar que o filtro da tabela raiz por `organizacao_id` impede vazamento.
9. Cobrir no endpoint: token revogado, expirado, colaborador inativo, organização suspensa/expirada, header malformado e token sem escopo.
10. Garantir cleanup idempotente e validar que nenhum fixture sobrevive após a suíte.

**Critério de aceite:** a job de integração roda verde contra banco isolado, sem `skip`, e prova A ↛ B para todas as ferramentas/resources atuais. Só então uma proposta separada poderá discutir ferramentas de escrita.

---

## Gate 2 — Contrato MCP e interoperabilidade real

**Meta:** tornar a compatibilidade com clientes um contrato testado, não uma suposição.

### Arquivos previstos

- Criar: `app/api/mcp/route.test.ts` ou `__tests__/mcp/route.integration.test.ts`
- Modificar quando necessário: `app/api/mcp/route.ts`, `lib/mcp/server.ts`, `lib/mcp/tools/*.ts`, `lib/mcp/resources.ts`, `lib/mcp/http.ts`

### TDD em fatias

1. Teste RED: `GET` e `DELETE` retornam 405 + `Allow: POST` sem cache. Já existe cobertura unitária; complementar no route-level.
2. Teste RED: POST sem Bearer retorna 401 neutro + `WWW-Authenticate: Bearer`, sem estado do token.
3. Teste RED: `initialize` autenticado retorna campos de servidor e capabilities consistentes.
4. Teste RED: `notifications/initialized`, `tools/list`, `resources/list`, cada `resources/read` e cada `tools/call` retornam formato JSON-RPC válido.
5. Teste RED: `Content-Type` inválido, `Accept` incompatível, corpo/JSON-RPC malformado e método/tool/resource desconhecido produzem os status/erros esperados pelo SDK sem stack/SQL.
6. Teste RED: ferramenta sem escopo responde erro seguro, sem consultar dados fora do necessário.
7. Rodar MCP Inspector e Claude Code com token descartável gerado pela UI; registrar somente nomes das tools e códigos de resposta, nunca o token. Revogar o token após a prova.

**Critério de aceite:** contrato automático verde e validação manual registrada para Claude Code + Inspector. Documentar que o servidor é stateless, não oferece stream/resume/progresso e requer POST com headers MCP compatíveis.

---

## Gate 3 — Segurança operacional de endpoint público

**Meta:** reduzir abuso, vazamento e superfície de ataque do Bearer endpoint.

### Escopo

1. Definir limite de tamanho do corpo antes de parsear JSON e retornar erro seguro para payload excessivo.
2. Implementar rate limit por token ID resolvido e por IP/forwarded IP confiável, com 429 + `Retry-After`.
3. Definir timeout/budget de execução de queries e máximo de registros/bytes; nunca aceitar paginação que atravesse escopo.
4. Definir política explícita de Host/Origin para domínios Vértice. Não habilitar CORS aberto.
5. Criar testes para throttle, body grande, Host/Origin rejeitado e ausência de logs com Authorization/token/hash.

**Risco/decisão:** escolher armazenamento de rate limit compatível com containers/restarts do Coolify (não depender de memória local para garantia distribuída). Se não houver Redis/serviço apropriado, registrar a limitação e não afirmar proteção distribuída.

---

## Gate 4 — Auditoria, observabilidade e resposta a incidente

**Meta:** um dono/admin consegue saber como o token é usado e responder a abuso sem ver segredo ou conteúdo sensível.

### Escopo

1. Modelar migration nova para eventos MCP: `token_id`, organização, colaborador, método/tool/resource, categoria de resultado, duração, timestamp, correlation ID e metadados minimizados de cliente/IP. Nunca armazenar Bearer, hash, payload ou resposta.
2. Testar migration/autorizações e writer de auditoria antes de escrever código de produção.
3. Registrar autenticação aceita/negada, execução de ferramenta/resource, erro seguro e rate limit.
4. Retornar correlation ID seguro quando uma falha precisar de suporte; logar causa interna apenas no servidor.
5. Exibir no Perfil: último uso bem-sucedido, data/hora e cliente minimizado. Exibir ao admin/operador sinais agregados de abuso conforme autorização existente.
6. Criar `docs/RUNBOOK-MCP.md`: token comprometido, revogar, desabilitar globalmente o endpoint, investigar eventos, rollback e reativação.

**Critério de aceite:** o token pode ser revogado e a equipe consegue rastrear atividade por ID de token sem recuperar o segredo.

---

## Gate 5 — Ciclo de vida de tokens e experiência no app

**Meta:** transformar token pessoal em recurso administrável, não em segredo criado uma vez e esquecido.

### Arquivos previstos

- `app/(app)/perfil/mcp-actions.ts`
- `app/(app)/perfil/mcp-tokens-manager.tsx`
- `app/(app)/perfil/page.tsx`
- `lib/mcp-auth.ts`
- migrations novas sob `supabase/migrations/`
- testes de actions/UI/helpers correspondentes

### Escopo

1. Mostrar expiração, estado (ativo/expirado/revogado), último uso e fuso horário na lista.
2. Pedir confirmação para revogação e mantê-la imediata.
3. Rotação segura: criar substituto, mostrar uma única vez, revogar antigo apenas após confirmação; manter trilha de auditoria.
4. Definir TTL limitado/configurável, alerta de expiração próxima e limite de quantidade de tokens por usuário.
5. Validar escopos no banco em migration de continuidade: array não vazio, valores permitidos e sem duplicatas. Não confiar apenas no Zod da action.
6. Atualizar o guia in-app com domínio de produção, práticas de `.mcp.json`/secret manager, troubleshooting 401/406/415 e confirmação explícita de somente leitura.

**Critério de aceite:** usuário sabe quando/onde o token é usado, consegue substituir/revogar com segurança e não precisa de suporte para conectar Claude Code.

---

## Gate 6 — Contratos de dados e qualidade de leitura

**Meta:** respostas previsíveis, limitadas e semanticamente corretas.

1. Centralizar datas no fuso civil de São Paulo com clock testável; corrigir “semana atual” para semana-calendário ou renomear para últimos 7 dias.
2. Rejeitar `desde > ate`, datas inválidas e intervalos excessivos com erro público seguro.
3. Padronizar envelope JSON, schemas e exemplos de respostas de tools/resources.
4. Incluir paginação/cursor ou `truncated` explícito para limites existentes (500 apontamentos, 200 cartões).
5. Remover texto de produto sobre “registrar apontamento” enquanto não existe escrita MCP.
6. Versionar o contrato publicamente: atualizar `serverInfo.version` e manter changelog/compatibilidade.

---

## Gate 7 — Escrita MCP (proposta futura, NÃO implementar neste plano)

Somente começar em PR separado após os Gates 1–6 aprovados.

Cada ferramenta de escrita deve ter:

- escopo próprio e validado no banco;
- confirmação explícita e payload idempotente;
- regra de negócio reutilizada do domínio, nunca lógica paralela;
- auditoria completa;
- testes cross-org reais e testes de efeitos/rollback;
- revisão humana de segurança antes de publicação.

Começar por uma única ação de baixo risco. Não expor Console, billing, admin, plano/licença ou dados de terceiros por MCP sem desenho específico.

---

## Validação final e publicação

Antes de cada deploy:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Para mudanças que mexam em schema, aplicar somente migration nova ao banco de teste primeiro, regenerar `lib/database.types.ts` pelo schema real quando necessário e revisar o diff.

Para publicação no Coolify:

1. Confirmar `master` limpo e commit enviado.
2. Disparar deploy do app `cxw1rmqde2oyilsyw8w1ami0`.
3. Confirmar deployment `finished` no SHA esperado.
4. Confirmar aplicação `running:healthy`.
5. Validar externamente `https://vertice.teralabs.cloud/api/mcp` e a UI afetada.
6. Em teste autenticado, usar token descartável gerado pela UI e revogá-lo ao término.

## Ordem recomendada

0. Passo 0 — fundação do ambiente de integração (CI, banco de teste, job de integração).
1. Gate 1 — isolamento real.
2. Gate 2 — contrato e clientes.
3. Gate 3 — proteção do endpoint.
4. Gate 4 — auditoria/observabilidade.
5. Gate 5 — ciclo de tokens/onboarding.
6. Gate 6 — qualidade de dados/contrato.
7. Gate 7 — proposta separada de escrita.
