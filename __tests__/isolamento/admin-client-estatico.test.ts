// Roda sem banco, sempre. É o teste "estático" que a skill vertice-isolamento
// e docs/PLANO-PRODUTO.md (§Verificação) descrevem: ninguém importa o client
// de service role sem escopo fora de uma lista explícita, e ninguém em
// components/ importa utils/supabase/admin. Um uso novo obriga editar este
// arquivo, o que aparece no diff e vira conversa de revisão — é a diferença
// entre um teste que detecta e um que obriga a decidir.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(__dirname, '..', '..')

// Enquanto createOrgScopedAdminClient (Fase 4) não existe, createAdminClient
// é o único client de service role — e por isso a allowlist é ampla hoje.
// Depois da Fase 4, só quem usar createUnscopedAdminClient entra aqui, e a
// lista deve encolher para o que está descrito na skill vertice-isolamento.
// Levantada por grep em 08/08/2026 (`createAdminClient\(\)` em app/ lib/
// utils/) — são os 25 usos reais mais a definição. Nenhum deles ainda filtra
// por organizacao_id, porque a coluna não existe: é o estado esperado antes
// da Fase 4. O valor deste teste hoje é travar a lista — um USO NOVO tem que
// passar por aqui, mesmo que o filtro de organização só chegue depois.
const ALLOWLIST_CREATE_ADMIN_CLIENT = new Set([
  'utils/supabase/admin.ts', // a definição em si
  'lib/admin-guard.ts',
  // Fase 6: console do operador. `operadores` tem RLS sem política nenhuma —
  // só service role lê — então requireOperador() precisa do bypass para
  // checar se auth.uid() tem linha ali. page.tsx e actions.ts leem/escrevem
  // `organizacoes`, que também não tem policy para quem não pertence a
  // nenhuma organização (o operador não pertence a nenhuma).
  'lib/operador-auth.ts',
  'app/(operador)/console/page.tsx',
  'app/(operador)/console/actions.ts',
  'lib/auditoria.ts',
  'lib/google-calendar.ts',
  'lib/notifications.ts',
  'lib/push.ts',
  'lib/variaveis-cartao.ts',
  'app/q/[token]/page.tsx',
  'app/formularios/[slug]/page.tsx',
  'app/login/mfa-actions.ts',
  'app/api/cron/alerta-queda/route.ts',
  'app/api/cron/google-calendar-sync/route.ts',
  'app/api/cron/kanban-automacoes/route.ts',
  'app/api/cron/kanban-recorrencia/route.ts',
  'app/api/cron/lembrete-diario/route.ts',
  // Ciclo de vida: age sobre organizacoes (a própria tabela do eixo) e por
  // definição sobre as que estão fora de org_atual() — trial vencido é
  // justamente quem deixou de ser visível. Não há sessão de usuário a que
  // escopar; quem decide o critério é transicionar_organizacoes() no banco.
  'app/api/cron/organizacoes-ciclo/route.ts',
  'app/api/cron/relatorio-semanal/route.ts',
  'app/api/google/callback/route.ts',
  'app/api/google/calendar/sync/route.ts',
  'app/api/google/disconnect/route.ts',
  'app/(app)/colaboradores/actions.ts',
  'app/(app)/kanban/actions.ts',
  'app/(app)/kanban/actions-anexos.ts',
  'app/(app)/minha-semana/page.tsx',
  'app/(app)/perfil/actions.ts',
  // A leitura de google_workspace_conexoes saiu de /perfil e depois de
  // /configuracoes para lib/google-conexao.ts, porque /setup faz a mesma
  // leitura. Continua com colaborador_id vindo da sessão e organizacao_id
  // explícito — agora num lugar só.
  'lib/google-conexao.ts',
  // Setup inicial: marca setup_concluido_em na própria linha de quem está
  // logado. Precisa do bypass porque colaboradores_update_gestor só deixa
  // gestor escrever, e o setup é a primeira tela de todo mundo. Id vem de
  // requireUser(), organizacao_id do perfil da sessão.
  'app/(app)/setup/actions.ts',
  'app/(app)/kanban/actions-emails.ts', // filtra por profile.organizacao_id
  // Fase 7: cadastro público cria a organização (criar_organizacao) antes
  // de qualquer sessão existir — não há org para filtrar ainda.
  'app/(marketing)/cadastro/actions.ts',
  // Fase 7: aceite de convite, mesmo padrão de app/q/[token] — o hash do
  // token é a única autorização, e aceitar_convite() deriva
  // organizacao_id só da própria linha do convite (conferido: skill
  // vertice-isolamento regra 5, sem id externo entrando sem filtro).
  'app/convite/[token]/actions.ts',
  'app/convite/[token]/page.tsx',
  // Servidor MCP (docs/PLANO-MCP.md): sem impersonação de sessão (o projeto
  // assina com JWT Signing Keys assimétricas, não há segredo simétrico para
  // reaproveitar), o MCP roda inteiramente via service role — deliberadamente
  // confinado a estes dois arquivos, nenhuma tool importa createAdminClient
  // diretamente. resolverMcpToken() usa o bypass porque roda antes de
  // qualquer sessão existir (é o próprio token que prova a identidade);
  // lib/mcp/queries.ts usa porque não há RLS para se apoiar, então filtra
  // organizacao_id/colaborador_id manualmente em toda consulta.
  'lib/mcp-auth.ts',
  'lib/mcp/queries.ts',
  // Webhook de formulário (pedido do produto, caso de uso citado foi n8n):
  // mesmo esquema do MCP — sem sessão de usuário, o Bearer token é a própria
  // prova de identidade, então resolverWebhookFormulario roda via service
  // role. lib/formulario-submissao.ts é o núcleo de criação de card
  // compartilhado com submeterFormulario (app/(app)/kanban/actions.ts, já
  // na lista) e sempre recebe o client já escopado pelo chamador — nunca cria
  // o próprio client fora dos dois pontos de entrada abaixo.
  'lib/formulario-webhook-auth.ts',
  'lib/formulario-submissao.ts',
  'app/api/webhooks/formularios/route.ts',
])

function listarArquivosTs(dir: string, ignorar: string[] = ['node_modules', '.next', '.git']): string[] {
  const resultado: string[] = []
  for (const entrada of readdirSync(dir)) {
    if (ignorar.includes(entrada)) continue
    const caminho = join(dir, entrada)
    const info = statSync(caminho)
    if (info.isDirectory()) {
      resultado.push(...listarArquivosTs(caminho, ignorar))
    } else if (/\.(ts|tsx)$/.test(entrada) && !entrada.endsWith('.test.ts')) {
      resultado.push(caminho)
    }
  }
  return resultado
}

function arquivosQueImportam(padrao: RegExp, escopo: string): string[] {
  const encontrados: string[] = []
  for (const caminho of listarArquivosTs(join(RAIZ, escopo))) {
    const conteudo = readFileSync(caminho, 'utf-8')
    if (padrao.test(conteudo)) encontrados.push(relative(RAIZ, caminho))
  }
  return encontrados
}

describe('uso do client de service role', () => {
  it('createAdminClient() só aparece em arquivos da allowlist', () => {
    const usos = [
      ...arquivosQueImportam(/createAdminClient/, 'app'),
      ...arquivosQueImportam(/createAdminClient/, 'lib'),
      ...arquivosQueImportam(/createAdminClient/, 'utils'),
    ]
    const foraDaLista = usos.filter((arquivo) => !ALLOWLIST_CREATE_ADMIN_CLIENT.has(arquivo))

    expect(
      foraDaLista,
      `Uso novo de createAdminClient() fora da allowlist: ${foraDaLista.join(', ')}. ` +
        'Se é legítimo (bypassa RLS de propósito, com filtro de organizacao_id explícito ' +
        'quando o eixo existir), adicione o arquivo à allowlist neste teste — a decisão ' +
        'precisa aparecer no diff. Ver skill vertice-isolamento, regra 5.'
    ).toEqual([])
  })

  it('nenhum componente client importa utils/supabase/admin', () => {
    const usos = arquivosQueImportam(/from ['"]@\/utils\/supabase\/admin['"]/, 'components')
    expect(
      usos,
      `components/ não deveria importar o client de service role: ${usos.join(', ')}. ` +
        'Isso rodaria a chave de service role no navegador.'
    ).toEqual([])
  })
})
