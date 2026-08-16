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

> **Atualização de 15–16/08/2026 — escrita e proteção do endpoint.** As
> ferramentas de escrita do Gate 7 existem a partir de
> `20260815140000_mcp_escrita.sql` e `lib/mcp/mutations.ts`; o Gate 3 (limite
> de corpo, rate limit por token e IP, política de Origin) veio junto em
> `20260816120000_mcp_rate_limit.sql` e `lib/mcp/rate-limit.ts`. A suíte de
> integração ampliada rodou verde contra banco real em 16/08/2026 (run
> 31916807854) e passou a rodar em todo PR que toque MCP. Cada gate registra
> abaixo o que ficou de fora — em especial o Gate 4
> (auditoria/observabilidade de leitura), ainda pendente, e o achado de fuso
> horário do Gate 6, que é um bug de produto anterior ao MCP e continua aberto.
> Falta também a revisão humana de segurança antes de publicar.

## Regras inegociáveis

1. ~~**Escrita fica bloqueada.**~~ **Escrita é permitida apenas nas quatro
   ferramentas do Gate 7**, com escopo próprio, e continua proibida para
   demandas, administradores, planos, assinaturas e Console. Uma ferramenta de
   escrita nova não herda essa autorização: passa pelo mesmo desenho (escopo,
   idempotência, regra reusada do domínio, trilha, teste cross-org).
2. Cada consulta em `lib/mcp/queries.ts` deve ter filtro explícito `organizacao_id`; leituras pessoais também devem filtrar o colaborador derivado do token.
3. Tokens e headers jamais entram em Git, logs, documentação, testes ou mensagens. `.mcp.json` segue ignorado.
4. Aplicar migrations apenas novas e estreitas; nunca reescrever uma migration já aplicada.
5. Para toda mudança comportamental: teste falhando → implementação mínima → teste verde → suíte/lint/build.
6. Não declarar o MCP “produto total” apenas porque a UI ou o endpoint respondem; os gates abaixo exigem evidência executável.

---

## Passo 0 — Fundação do ambiente de integração (bloqueia o Gate 1)

**Meta:** existir onde, com quê e por quem a suíte de integração do Gate 1 roda, antes de escrever a primeira fixture. Sem isso, "Gate 1 verde" não tem lugar para acontecer — hoje o repositório não tem `.github/workflows/` nem qualquer pipeline de CI, e o deploy é manual via Coolify.

**Status (12/08/2026):** projeto Supabase exclusivo de integração provisionado, migrations aplicadas, secrets `MCP_INTEGRATION_SUPABASE_URL`/`MCP_INTEGRATION_SERVICE_ROLE_KEY` cadastrados exclusivamente no GitHub Actions e workflow executado verde contra banco real. A suíte `__tests__/isolamento/mcp-real.integration.test.ts` cria organizações A/B e prova por token resolvido + `tools/call`/`resources/read` que as superfícies read-only atuais não devolvem marcadores de B para A. Ainda falta a prova pelo endpoint HTTP/JSON-RPC e a revisão do fluxo de token fixture para satisfazer integralmente os critérios 0.4/Gate 1; portanto escrita MCP permanece bloqueada. Sequência operacional: [`CHECKLIST-MCP-INTEGRACAO.md`](./CHECKLIST-MCP-INTEGRACAO.md).

### 0.1 Decisão de execução

1. Criar uma esteira de CI mínima dedicada à suíte de integração MCP. Provedor: **GitHub Actions** — o repositório já vive em `canhetejr/vertice` no GitHub; não introduzir um serviço de CI novo só para isso. Escopo mínimo: um workflow que roda `npm test` incluindo `__tests__/isolamento/mcp-real.integration.test.ts` (a criar no Gate 1) contra o banco de teste do item 0.2. **Feito:** `.github/workflows/mcp-integracao.yml` — dispara em `workflow_dispatch` e em push a `master` que toque caminhos de MCP; falha explicitamente no passo "Verificar credenciais" enquanto os secrets `MCP_INTEGRATION_SUPABASE_URL`/`MCP_INTEGRATION_SERVICE_ROLE_KEY` não existirem (0.2 pendente); roda `npm test -- __tests__/isolamento`, que passa a incluir a suíte real assim que o Gate 1 criar o arquivo.
2. Enquanto essa CI não existir e não estiver rodando de fato, **nenhum deploy que altere código de MCP pode ser tratado como "Gate 1 aprovado"** — mesmo que a suíte tenha sido rodada manualmente uma vez na máquina de alguém. Aprovação de gate exige execução repetível e registrada, não uma corrida local isolada.
3. A suíte de isolamento não pode ser pulada (`skip`, `it.skip`, ou credencial ausente tratada como "ok") no ambiente de release: se `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do banco de integração não estiverem disponíveis no job de release, o job **falha**, nunca passa em silêncio. O padrão atual de pular com aviso em `__tests__/isolamento/*.test.ts` continua válido só para desenvolvimento local, nunca para CI/release.

### 0.2 Provisionamento

Passo a passo executável em [`CHECKLIST-MCP-INTEGRACAO.md`](./CHECKLIST-MCP-INTEGRACAO.md) — aqui fica só a regra; lá fica a sequência para marcar.

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

1. Gatilho: no mínimo, disparo manual sob demanda (`workflow_dispatch`), mais execução automática antes de qualquer deploy que toque `lib/mcp*`, `app/api/mcp/**` ou `supabase/migrations/*mcp*`. Rodar em todo push é aceitável se o tempo do job permitir; não é obrigatório rodar em todo commit do repositório inteiro. O repositório hoje não tem PR obrigatório nem branch protection documentados — antes de configurar o workflow, confirmar se o fluxo real é push direto em `master` ou baseado em PR, porque isso decide se o gatilho é `push` ou `pull_request`.
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

Definidos no Passo 0 — não redefinir aqui, só confirmar que estão prontos antes de começar a fatia 1:

- Ambiente Supabase de integração provisionado e credenciais de CI configuradas (0.2).
- Workflow de GitHub Actions existente e capaz de falhar sem as credenciais (0.1, 0.3).
- Convenção de fixture (`mcp-it-<uuid>`, cleanup idempotente) já fixada em 0.3.5 — reutilizar, não redefinir.

Se qualquer um desses três não estiver de pé, o Passo 0 não está concluído e a fatia 1 abaixo não começa.

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

## Gate 3 — Segurança operacional de endpoint público (implementado em 16/08/2026)

**Meta:** reduzir abuso, vazamento e superfície de ataque do Bearer endpoint.

### Escopo

1. ✅ **Limite de corpo antes do parse** — 256 KiB (`LIMITE_CORPO_BYTES` em
   `lib/mcp/http.ts`), conferido duas vezes: `Content-Length` primeiro, para
   cortar cedo, e o tamanho real em bytes depois, porque o header é dica do
   cliente e não garantia. Responde `413` sem detalhe interno.
2. ✅ **Rate limit por token e por IP**, com `429` + `Retry-After` em segundos.
   Padrões: 120/min por token, 240/min por IP, janela de 60s — ajustáveis por
   `MCP_RATE_LIMIT_TOKEN`, `MCP_RATE_LIMIT_IP` e
   `MCP_RATE_LIMIT_JANELA_SEGUNDOS`. O teto por IP é maior de propósito: uma
   empresa inteira sai pelo mesmo IP, e um teto baixo puniria o vizinho de rede
   em vez do abusador; o que ele contém é varredura de token.
3. ⬜ **Timeout/budget de query e máximo de registros** — pendente. Os limites
   fixos de hoje (500 apontamentos, 200 cartões) continuam como estão, sem
   paginação; ver Gate 6, item 4.
4. ✅ **Política de Origin** — `origemPermitida()` deixa passar requisição sem
   `Origin` (o caso do cliente MCP, que não manda) e exige domínio Vértice
   quando ele existe, com casamento exato. É a defesa contra DNS rebinding que
   a especificação recomenda. CORS aberto continua fora de questão.
5. ✅ **Testes** para corpo grande, `Retry-After` (inclusive o piso, para o
   cliente nunca ler `0` e repetir em laço), Origin aceito/recusado e método
   não permitido, em `lib/mcp/http.test.ts`.

**Ordem das checagens na rota**, deliberada: o que é barato e não toca o banco
vem primeiro (origem, tamanho declarado), depois o limite por IP, depois a
resolução do token, e só então o limite por token. Uma varredura automatizada é
descartada antes de custar uma consulta de token.

**Risco/decisão — armazenamento.** Não há Redis no projeto. O contador vive no
Postgres (`mcp_rate_limite` + `mcp_consumir_rate_limit`, migration
`20260816120000`), com o incremento feito dentro de um único `INSERT … ON
CONFLICT DO UPDATE` — duas requisições simultâneas da mesma chave não
conseguem ler o mesmo valor e gravar o mesmo resultado. Vale para todas as
réplicas, sobrevive a restart de container e custa um round-trip por
requisição. Duas limitações registradas, não escondidas:

- **Janela fixa, não deslizante:** na virada da janela o teto real chega a 2x o
  configurado. Aceito — o objetivo é conter abuso e laço de agente, não modelar
  tráfego com precisão.
- **Falha aberta:** se o limitador não responder, a requisição segue. O recurso
  protegido é o mesmo Postgres que acabou de falhar, então passar por cima do
  limite não concede acesso a nada; falhar fechado transformaria uma
  instabilidade momentânea numa onda de `429` apontando para o lugar errado.

**Ainda não medido:** o custo do round-trip extra por requisição sob carga
real. O endpoint não tem tráfego de produção suficiente para essa medição hoje.

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

   **Achado concreto (16/08/2026), ainda NÃO corrigido.** A escrita grava em
   `current_date` — data do servidor, em UTC — enquanto toda leitura usa
   `lib/dates::hoje()`, que é a data civil de São Paulo. Entre 21:00 e 00:00 de
   São Paulo os dois discordam: um apontamento registrado nesse intervalo nasce
   com a data do dia seguinte e some de "meus apontamentos de hoje".
   Não é específico do MCP — `registrar_apontamento()` sempre usou
   `current_date`, então a interface tem exatamente o mesmo comportamento, e é
   por isso que a correção não entrou junto com a escrita: mudar isso altera a
   dataçāo de apontamento para todo mundo e merece uma decisão explícita, não
   um efeito colateral de uma leva de MCP.
   Foi assim que a suíte de integração falhou na primeira execução em CI: as
   fixtures usavam data UTC e o job rodou 00:09 UTC. A suíte passou a datar
   pelo fuso de São Paulo; o produto continua como estava.
2. Rejeitar `desde > ate`, datas inválidas e intervalos excessivos com erro público seguro.
3. Padronizar envelope JSON, schemas e exemplos de respostas de tools/resources.
4. Incluir paginação/cursor ou `truncated` explícito para limites existentes (500 apontamentos, 200 cartões).
5. Remover texto de produto sobre “registrar apontamento” enquanto não existe escrita MCP.
6. Versionar o contrato publicamente: atualizar `serverInfo.version` e manter changelog/compatibilidade.

---

## Gate 7 — Escrita MCP (implementado em 15/08/2026)

Contrato MCP `0.2.0`. Quatro ferramentas de escrita, todas restritas ao próprio
colaborador do token:

| Ferramenta | Escopo | Efeito |
| --- | --- | --- |
| `apontamento_registrar` | `apontamento:escrita` | Apontamento de HOJE, via `registrar_apontamento_para` |
| `cartao_criar` | `kanban:escrita` | Cartão na coluna informada, com quem chamou como responsável |
| `cartao_mover` | `kanban:escrita` | Move dentro do MESMO quadro; dispara as automações |
| `cartao_comentar` | `kanban:escrita` | Comentário `tipo = 'usuario'`, assinado pelo colaborador |

Leituras de apoio adicionadas junto, porque sem elas o agente não teria de onde
tirar um id válido: `quadros_listar`, `cartao_detalhe` e o resource
`vertice://quadros/meus`.

### Como cada exigência do desenho original foi atendida

- **Escopo próprio e validado no banco** — `apontamento:escrita` e
  `kanban:escrita` são escopos separados dos de leitura: token existente não
  ganha escrita por atualização de servidor. `mcp_escopos_validos()` +
  constraint `mcp_tokens_escopos_validos` recusam array vazio, valor inventado
  e duplicata; o default `'{}'` da coluna foi removido.
- **Payload idempotente** — `chave_idempotencia` opcional em toda tool de
  escrita. A reserva em `mcp_escritas` é gravada ANTES do efeito, e o índice
  único `(token_id, ferramenta, chave_idempotencia)` decide o vencedor de duas
  chamadas simultâneas; falha de regra apaga a reserva para não queimar a
  chave.
- **Confirmação explícita** — as descrições das tools dizem, em texto, que a
  ferramenta escreve e que o agente deve confirmar com a pessoa antes de
  chamar. É orientação ao modelo, não trava técnica: não substitui o
  consentimento no cliente MCP.
- **Regra de negócio reutilizada** — `registrar_apontamento()` foi refatorada
  para delegar a `registrar_apontamento_para(p_colaborador_id, …)`, que carrega
  o corpo inteiro. Zero regra de apontamento reescrita em TypeScript. No
  kanban, as regras de movimentação continuam nos triggers
  (`trg_cartoes_validar_saida_etapa`), que valem para service role igual valem
  para a sessão do browser; o MCP só traduz a exceção.
- **Acesso ao quadro** — `pode_acessar_quadro(p_quadro_id, p_colaborador_id)` é
  a mesma regra de `is_quadro_membro()`, parametrizada porque `auth.uid()` é
  NULL sob service role; `is_quadro_membro()` passou a delegar a ela. Sem grant
  para `authenticated`: exposta em `/rest/v1/rpc` seria sonda de existência.
- **Auditoria** — toda escrita bem-sucedida grava em `mcp_escritas`
  (organização, token, colaborador, ferramenta, entidade, resultado
  minimizado — nunca token, hash ou payload bruto) e em `auditoria`, com
  `acao: 'mcp.*'`, para que "quem alterou isto" tenha uma resposta só.

### Verificado

- `npm test` (629 testes), `npm run lint` e `npm run build` verdes.
- `lib/mcp/mutations.test.ts`: idempotência (repetição não reescreve, chamada
  em andamento recusa, falha não queima a chave), escopo, e recusa de
  coluna/cartão de outra organização com asserção sobre os filtros aplicados.
- Contra o banco de integração real (`vertice-mcp-integracao`), por SQL:
  `registrar_apontamento_para` com colaborador de X e demanda de Y é recusado
  (`DEMANDA_INATIVA`) e não grava linha; na própria organização grava com o
  `organizacao_id` certo. `pode_acessar_quadro` responde `false` para
  colaborador de X num quadro de Y. `mcp_escopos_validos` recusa vazio,
  duplicata, valor inventado e NULL.

### Em aberto — ler antes de tratar como concluído

1. **Primeira execução real em CI: 16/08/2026 — as provas de isolamento
   passaram, o resto não.** Todas as asserções cross-org verdes: nenhum dado de
   B em resposta para A, escrita com id de B recusada em apontamento, cartão,
   movimentação e comentário, token sem escopo barrado sem sequer abrir linha
   de trilha, e `mcp_escritas` só com linhas da organização A. As cinco falhas
   foram de outra natureza e estão corrigidas:
   - cleanup não apagava `quadros_membros` e travava na FK de `quadros`;
   - duas asserções minhas erradas (contagem que ignorava o apontamento da
     própria fixture; `toContain` sobre JSON escapado dentro do envelope
     JSON-RPC);
   - fixtures datadas em UTC contra leitura em fuso de São Paulo (ver Gate 6,
     item 1 — o bug de produto por trás disso continua aberto);
   - `agendarSincronizacaoGoogle` usa `after()` do Next, que exige request
     scope e lançava quando a suíte chama o handler direto — derrubando a
     criação de cartão DEPOIS de gravar. Virou best-effort, que é a política
     correta de qualquer forma.
   - timeout de 5s do vitest, curto para uma chamada que faz vários
     round-trips (o limitador do Gate 3 acrescentou dois por requisição).

   **Execução verde em 16/08/2026**, com as correções aplicadas: run
   [31916807854](https://github.com/canhetejr/vertice/actions/runs/31916807854),
   commit `987cdbee`, 13/13 testes do arquivo de isolamento MCP, 119 testes no
   total, zero falhas, sem `skip`. É a evidência que o Passo 0.4 pedia e que o
   Gate 1 exigia — e ela agora roda em todo PR que toque MCP, não só depois do
   merge.

   Observação do log dessa execução: o `after()` do Next continua lançando fora
   de request scope, e o `console.error` do tratamento best-effort aparece na
   saída. É o comportamento esperado no contexto de teste — a escrita segue e o
   cartão é criado; em produção, dentro do request scope da rota, o `after()`
   funciona normalmente e a sincronização é agendada.
2. **Revisão humana de segurança** antes de publicar, como o desenho original
   já exigia.
3. ~~Gate 3 pendente~~ — fechado em 16/08/2026; ver o Gate 3 acima, inclusive
   as duas limitações registradas (janela fixa, falha aberta).
4. ~~Constraint de escopos `NOT VALID`~~ — validada em `20260816120000`, depois
   de conferir que produção e integração tinham 4 tokens cada, nenhum vazio,
   fora do catálogo ou com duplicata. A migration falha em voz alta se
   encontrar linha ruim, em vez de pular em silêncio.

Continua fora de escopo, sem desenho específico: Console, billing, admin,
plano/licença, edição/exclusão de apontamento, movimentação entre quadros e
qualquer escrita em nome de terceiros.

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
