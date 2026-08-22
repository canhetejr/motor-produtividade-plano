# Relatório de conferência — Motor de Produtividade

Data da conferência: 22/07/2026
Projeto: `C:\Users\luizfernando.junior\Desktop\motor-produtividade-plano`

## 1. Resumo executivo

O projeto está tecnicamente compilável e o lint passa, mas ainda não deve ser liberado para uso institucional sem uma etapa de correção e validação do banco. O principal bloqueio é a divergência entre o código atual, as migrations mais recentes e o roteiro de aplicação no banco: o código grava campos de snapshot, avatar e preferências de notificação, enquanto o script consolidado de produção não aplica essas alterações.

Resultado geral: **APROVADO COM RESSALVAS — NÃO PRONTO PARA PRODUÇÃO**.

Há também uma brecha de integridade no RLS de `apontamentos`: um colaborador autenticado pode chamar diretamente a API do Supabase para inserir apontamentos em datas passadas, com parâmetros de cálculo manipulados, porque a policy de INSERT valida apenas o proprietário. A Server Action valida o fluxo normal, mas não protege chamadas diretas ao Supabase.

## 2. Evidências executadas

| Verificação | Resultado |
|---|---|
| `npm run lint` | PASSOU, exit code 0 |
| `npm run build` | PASSOU, exit code 0; TypeScript compilou |
| `git diff --check` | FALHOU por whitespace à linha 158 de `app/globals.css` |
| `npm audit --omit=dev` | FALHOU: 9 vulnerabilidades (6 moderate, 3 high) |
| Testes automatizados | Não encontrados |
| Teste real das migrations/RLS | Não executado; requer acesso ao projeto Supabase |
| Teste manual dos crons | Não executado; requer `CRON_SECRET` e service role válidos |

O working tree contém muitas alterações não commitadas: 35 arquivos rastreados com mudanças, além de novos arquivos/diretórios. Não foi feito commit nem alteração corretiva no código de produção.

## 3. Achados prioritários

### CRÍTICO — produção existente pode quebrar ao lançar apontamentos

**Evidência:**

- `app/(app)/apontamento/actions.ts:100-112` insere `tempo_padrao_snapshot` e `blocos_totais_snapshot`.
- A migration correspondente é `supabase/migrations/20260721070000_apontamentos_snapshot_travas.sql`.
- `supabase/APLICAR_PENDENTES.sql:1-20` consolida somente seis migrations e não inclui `20260721060000_perfil_avatar_notif_prefs.sql` nem `20260721070000_apontamentos_snapshot_travas.sql`.
- `README.md:61-74` lista as migrations até `20260721040000`, também omitindo as migrations 6000 e 7000.
- `docs/TASKS.md:96-102` registra que a migration de perfil ainda precisa ser aplicada, e não registra a migration 7000 como aplicada.

**Impacto:** em um banco existente sem a migration 7000, o lançamento normal tende a falhar por colunas inexistentes. Sem a migration 6000, `/perfil` pode falhar ao selecionar `avatar_url` e preferências. O sistema pode compilar e mesmo assim ficar indisponível em runtime.

**Recomendação:** antes do deploy, aplicar e verificar, na ordem, as migrations 6000 e 7000 no banco real. Atualizar `APLICAR_PENDENTES.sql`, `README.md` e `docs/TASKS.md` para terem uma única lista canônica. Fazer um smoke test real de login, lançamento, perfil e crons depois da aplicação.

### ALTO — RLS permite inserção direta de apontamentos em qualquer data

**Evidência:**

- `supabase/schema.sql:208-210` e `supabase/migrations/0001_baseline.sql:90-91` definem `apontamentos_insert_own` apenas com `colaborador_id = auth.uid()`.
- `20260721013000_apontamentos_rls_data_atual.sql` corrige UPDATE e DELETE, mas não altera INSERT.
- `app/(app)/apontamento/actions.ts:107` envia `data: hoje()` apenas no fluxo normal da aplicação.

**Impacto:** um colaborador autenticado pode chamar a REST API do Supabase e criar registros próprios em dias passados ou futuros, contornando a regra de apontamento diário e contaminando dashboard, alertas e relatório semanal.

**Recomendação:** restringir INSERT a `colaborador_id = auth.uid() AND data = current_date` na policy; idealmente também mover a validação de coerência para o banco (trigger ou função RPC), pois RLS não garante que snapshot, tempo manual, motivo e demanda estejam coerentes.

### ALTO — campos de cálculo podem ser manipulados por chamada direta ao Supabase

**Evidência:**

A policy de INSERT não restringe os campos `tempo_manual_min`, `tempo_padrao_snapshot`, `blocos_totais_snapshot`, `quantidade` e `motivo`. A validação de `app/(app)/apontamento/actions.ts:64-112` só existe na Server Action. A própria migration 7000 descreve a trava de blocos, mas ela não impede que um usuário injete snapshots falsos; além disso, o banco não impõe que `tempo_manual_min` só exista para demanda variável nem que `motivo` pertença ao conjunto permitido.

**Impacto:** um usuário pode fabricar tempo entregue e elevar artificialmente o próprio índice, inclusive usando snapshot incompatível com o catálogo atual.

**Recomendação:** usar uma RPC transacional `registrar_apontamento` com `SECURITY DEFINER` e validações de servidor/banco, ou trigger que derive os snapshots da demanda e valide a data, demanda ativa, área e campos de “Outros”. Revogar INSERT direto da tabela para o papel autenticado quando a RPC estiver pronta.

### ALTO — script de aplicação do banco está desatualizado em relação ao schema final

**Evidência:**

`supabase/schema.sql:50-60` já representa snapshot e constraint; entretanto o script `supabase/APLICAR_PENDENTES.sql` recria a view antiga baseada em `demandas.tempo_padrao_min` e `demandas.blocos_totais` (`:128-147`) e não aplica snapshot.

**Impacto:** aplicar o script consolidado pode deixar o banco em um estado diferente do código e do `schema.sql`. Mesmo que o lançamento continue funcionando, alterações posteriores no catálogo podem reescrever historicamente os tempos dos apontamentos nesse banco.

**Recomendação:** regenerar o consolidado a partir das migrations reais, incluindo 6000 e 7000, ou abandonar o consolidado e executar cada migration versionada em ordem. Depois conferir a definição das views no catálogo do Supabase.

### ALTO — ausência de testes automatizados e de testes de autorização

**Evidência:** não foram encontrados arquivos de teste. `docs/TASKS.md:28-29` deixa pendente validar RLS contra edição de apontamento de outra pessoa; `docs/TASKS.md:54-55` deixa pendente testar manualmente os três crons; `docs/TASKS.md:71-72` deixa pendente revisão final de RLS.

**Impacto:** o build verifica tipos e compilação, mas não prova regras de negócio, isolamento entre usuários, comportamento do banco, upload, exportação ou crons.

**Recomendação:** criar uma matriz de testes de autorização com duas contas (colaborador/gestor), testes de Server Actions e testes HTTP dos crons. Executar contra um projeto Supabase de staging, não contra produção.

### MÉDIO — `npm audit` reporta vulnerabilidades transitivas

**Evidência:** `npm audit --omit=dev` reportou 9 vulnerabilidades: 3 high e 6 moderate, incluindo `sharp`, `postcss`, `fast-uri`, `uuid` e `@hono/node-server`/dependências do pacote `shadcn`. O `npm audit fix --force` propõe downgrades incompatíveis de Next.js/shadcn/ExcelJS, portanto não deve ser aplicado automaticamente.

**Impacto:** parte das vulnerabilidades está em dependências de build ou transitivas, mas o risco precisa ser tratado antes de exposição pública.

**Recomendação:** revisar `npm audit --json`, atualizar dependências por cadeia sem `--force`, testar novamente build/lint e registrar exceções justificadas. Em especial, acompanhar atualização compatível de `next`/`sharp` e avaliar se `shadcn` deve permanecer como dependência de runtime.

### MÉDIO — notificações de tipos diferentes usam a preferência errada

**Evidência:** `lib/notifications.ts:42-50` faz `notificarGestores()` filtrando sempre `notif_solicitacoes = true`. Essa função também é chamada para `outros_grande` em `app/(app)/apontamento/actions.ts:124-129`.

**Impacto:** a preferência “solicitações de demanda” controla indevidamente o alerta de lançamento grande de “Outros”. Um gestor que desativar solicitações pode deixar de receber esse alerta, ou manter alertas contra a expectativa configurada.

**Recomendação:** separar os tipos de preferência (`notif_solicitacoes` e um tipo específico para alertas in-app de “Outros”) ou remover a preferência caso o alerta não deva ser configurável.

### MÉDIO — fluxo de aprovação não é transacional

**Evidência:** `app/(app)/catadocs/assets/brand-source/actions.ts:224-285` marca a solicitação como `APROVADA` antes de inserir/atualizar `demandas` e depois pode voltar para `PENDENTE` em falhas. A notificação é criada em outra operação.

**Impacto:** em falha de rede, concorrência ou erro inesperado entre as operações, pode haver estado intermediário ou divergência entre status e demanda. O rollback manual não é uma transação única.

**Recomendação:** encapsular claim, aplicação da demanda, status e evento de notificação em uma função SQL/RPC transacional com controle de concorrência. No mínimo, tratar e auditar falhas do update de rollback.

### MÉDIO — validações importantes dependem exclusivamente do MIME enviado pelo cliente

**Evidência:** `app/(app)/perfil/actions.ts:98-113` valida avatar por `file.type` e tamanho. O tipo MIME é fornecido pelo cliente e pode ser forjado; não há inspeção do conteúdo/magic bytes.

**Impacto:** com bucket público, um arquivo malformado ou conteúdo inesperado pode ser armazenado como avatar. O risco é limitado pelo uso como `img`, mas a validação não é robusta.

**Recomendação:** validar assinatura/conteúdo no servidor, normalizar a imagem (por exemplo, reencodar com biblioteca segura), impor limites de dimensões e considerar bucket privado com URL assinada se as fotos não forem públicas.

### ALTO — usuários inativos continuam autorizados

**Evidência:** `lib/auth.ts:14-22` busca o perfil somente pelo `id`, sem filtrar `ativo = true`; `requireUser()` e `requireGestor()` aceitam o perfil encontrado. As policies em `supabase/schema.sql:196-214` também não verificam `colaboradores.ativo`.

**Impacto:** marcar um colaborador como inativo no painel não encerra automaticamente o acesso. Enquanto a conta Auth permanecer ativa, ele pode continuar usando o sistema e registrando apontamentos; o mesmo vale para gestores desativados.

**Recomendação:** exigir `ativo = true` no fluxo de autenticação/autorização e refletir a regra no RLS. Ao inativar, considerar desabilitar também o usuário no Supabase Auth.

### MÉDIO — exportação CSV permite formula injection

**Evidência:** `app/api/export/route.ts:7-12` escapa delimitadores, mas exporta diretamente nomes, motivos e observações (`:58-68`). Valores iniciados por `=`, `+`, `-` ou `@` podem ser interpretados como fórmulas pelo Excel.

**Impacto:** um valor controlado por usuário pode executar uma fórmula ao abrir o CSV no computador do gestor, com risco de chamadas externas ou exposição de dados.

**Recomendação:** neutralizar campos textuais que começam com caracteres de fórmula, prefixando-os com apóstrofo ou aplicando uma política explícita de sanitização. Aplicar a mesma proteção ao XLSX.

### MÉDIO — migration do snapshot não é plenamente idempotente

**Evidência:** `supabase/migrations/20260721070000_apontamentos_snapshot_travas.sql:40-43` cria a constraint sem verificar se ela já existe, embora a documentação diga que as migrations são idempotentes.

**Impacto:** reexecução após aplicação parcial ou em ambiente já contendo a constraint pode falhar.

**Recomendação:** verificar a constraint em bloco `DO` antes de criá-la ou usar o mecanismo oficial de migrations do Supabase.

### MÉDIO — crons podem duplicar e-mails em reexecuções

**Evidência:** os três handlers (`app/api/cron/lembrete-diario/route.ts`, `alerta-queda/route.ts` e `relatorio-semanal/route.ts`) não registram uma chave idempotente por tipo, destinatário e período.

**Impacto:** retry da Vercel, execução manual ou concorrência podem reenviar lembretes, alertas e relatórios.

**Recomendação:** criar log/chave de idempotência por cron e período, com controle de concorrência.

### MÉDIO — limites operacionais de cron não são escaláveis

**Evidência:** `lib/cron.ts:14-23` lista apenas a primeira página de até 1.000 usuários; os handlers carregam consultas e envios em memória.

**Impacto:** equipes maiores podem ter usuários sem e-mail, timeout, consumo excessivo de memória ou falhas no provedor de e-mail.

**Recomendação:** paginar usuários e consultas, agregar no banco e enviar e-mails em lotes controlados.

### BAIXO — falha de higiene do diff

**Evidência:** `git diff --check` detectou whitespace à linha 158 de `app/globals.css`.

**Impacto:** baixo; polui o diff e pode quebrar gates de CI que tratem whitespace como erro.

**Recomendação:** remover o whitespace e configurar `.gitattributes`/editor para normalizar finais de linha, se desejado.

### BAIXO — ausência de suíte automatizada e warning de código não utilizado

**Evidência:** não há script `test` no `package.json`; uma execução independente de lint observou `email` não utilizado em `components/layout/sidebar.tsx:27`.

**Impacto:** regras de RLS, crons e exportação não têm cobertura automatizada; o warning indica código morto ou contrato desatualizado.

**Recomendação:** criar testes de autorização/negócio e remover ou utilizar a propriedade não usada.

## 4. Pontos positivos confirmados

- TypeScript strict/build de produção passou.
- ESLint passou sem erros.
- Server Actions usam validação Zod em entradas principais.
- `requireUser()`/`requireGestor()` estão presentes nas páginas e ações administrativas relevantes.
- `CRON_SECRET` é comparado em igualdade exata no header `Authorization`.
- A service role está encapsulada em módulo `server-only` e o `.env.local` não está rastreado pelo Git.
- Exportação CSV escapa vírgulas, aspas e quebras de linha e inclui BOM UTF-8.
- A migration 0002 corrige a recursão de RLS e revoga acesso de `anon` às views.
- A migration 7000 introduz snapshot para evitar reescrita retroativa do histórico — desde que seja realmente aplicada.

## 5. Checklist funcional recomendado antes do go-live

1. Aplicar migrations 6000 e 7000 no staging e confirmar colunas, constraint, views, grants e policies.
2. Corrigir o INSERT de `apontamentos` para aceitar somente `current_date`.
3. Blindar o cálculo contra inserções REST diretas, preferencialmente com RPC/trigger.
4. Atualizar o consolidado `APLICAR_PENDENTES.sql` e a documentação.
5. Criar duas contas de teste e validar: isolamento de dados, edição/exclusão, tentativa de data passada, tentativa de outro colaborador, alteração de role e acesso às rotas.
6. Testar lançamento normal, “Outros”, demandas em blocos, demanda sem tempo, alteração de catálogo e preservação do histórico.
7. Testar exportação CSV/XLSX com acentos, aspas, quebras de linha e período inválido.
8. Testar os três crons com secret correto/incorreto, sem Resend, com Resend e com preferências desligadas.
9. Revisar dependências vulneráveis sem executar `npm audit fix --force` automaticamente.
10. Remover whitespace do diff, executar lint/build novamente e só então fazer deploy.

## 6. Conclusão

A base está em bom estado para continuidade de desenvolvimento e a compilação está saudável. A conferência, porém, encontrou inconsistências de deploy/migration e uma proteção RLS incompleta que afetam diretamente a confiabilidade dos indicadores. O próximo marco deve ser uma rodada de endurecimento do banco e testes de autorização em staging; depois disso, repetir esta conferência e registrar o resultado antes da abertura para a equipe.
