// Saúde dos crons e da configuração — lógica pura, sem banco e sem
// 'server-only', para o componente client importar os rótulos e o vitest
// importar a avaliação sem subir nada.

export type StatusCron = 'ok' | 'atrasado' | 'nunca'

export type CronDeclarado = {
  /** Valor gravado em cron_execucoes.tipo pelas rotas (lib/cron.ts). */
  tipo: string
  rotulo: string
  /** Exatamente como está no vercel.json. */
  agenda: string
  descricao: string
  /**
   * Horas sem execução até chamar de atrasado.
   *
   * Não vale escrever um parser de cron aqui: a pergunta do painel não é
   * "quando roda de novo", é "parou de rodar?". A folga precisa passar do
   * maior intervalo normal da agenda — um cron de dias úteis fica 72h parado
   * entre sexta e segunda, e marcar isso de vermelho todo fim de semana faria
   * o painel virar ruído que ninguém olha.
   */
  toleranciaHoras: number
}

export const CRONS_DECLARADOS: CronDeclarado[] = [
  {
    tipo: 'lembrete-diario',
    rotulo: 'Lembrete diário',
    agenda: '0 21 * * 1-5',
    descricao: 'Cobra quem não apontou no dia.',
    toleranciaHoras: 80, // dias úteis: 72h entre sexta e segunda + folga
  },
  {
    tipo: 'alerta-queda',
    rotulo: 'Alerta de queda',
    agenda: '0 11 * * 1-5',
    descricao: 'Avisa o gestor quando o índice de alguém cai.',
    toleranciaHoras: 80,
  },
  {
    tipo: 'relatorio-semanal',
    rotulo: 'Relatório semanal',
    agenda: '0 11 * * 1',
    descricao: 'Envia o consolidado da semana às segundas.',
    toleranciaHoras: 176, // semanal: 168h + folga
  },
  {
    tipo: 'kanban-recorrencia',
    rotulo: 'Recorrência do Kanban',
    agenda: '0 9 * * *',
    descricao: 'Clona os cards recorrentes que venceram.',
    toleranciaHoras: 30, // diário: 24h + folga
  },
  {
    tipo: 'kanban-automacoes',
    rotulo: 'Automações por tempo',
    agenda: '0 10 * * *',
    descricao: 'Avalia atraso e SLA — os eventos que nenhuma ação do usuário dispara.',
    toleranciaHoras: 30,
  },
]

export type SaudeCron = CronDeclarado & {
  ultimaExecucao: string | null
  status: StatusCron
  horasDesde: number | null
}

export function avaliarCron(
  cron: CronDeclarado,
  ultimaExecucao: string | null,
  agora: Date = new Date()
): SaudeCron {
  if (!ultimaExecucao) {
    return { ...cron, ultimaExecucao: null, status: 'nunca', horasDesde: null }
  }

  const horasDesde = (agora.getTime() - new Date(ultimaExecucao).getTime()) / 3_600_000

  return {
    ...cron,
    ultimaExecucao,
    horasDesde,
    status: horasDesde > cron.toleranciaHoras ? 'atrasado' : 'ok',
  }
}

/**
 * `obrigatoria` — sem ela algo simplesmente não funciona.
 * `alternativa` — pertence a um par de caminhos onde basta um estar completo
 *   (é o caso do e-mail: lib/email.ts tenta SMTP e cai para Resend).
 * `opcional` — tem fallback embutido no código.
 */
export type NivelEnv = 'obrigatoria' | 'alternativa' | 'opcional'

export type EnvEsperada = {
  nome: string
  rotulo: string
  /** O que para de funcionar sem ela — sem isso a lista é só um checklist mudo. */
  impacto: string
  nivel: NivelEnv
  grupo?: string
}

export const ENVS_ESPERADAS: EnvEsperada[] = [
  {
    nome: 'NEXT_PUBLIC_SUPABASE_URL',
    rotulo: 'URL do Supabase',
    impacto: 'Sem ela o app não conecta no banco.',
    nivel: 'obrigatoria',
  },
  {
    nome: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    rotulo: 'Chave pública do Supabase',
    impacto: 'Sem ela o login e toda leitura pelo browser param.',
    nivel: 'obrigatoria',
  },
  {
    nome: 'SUPABASE_SERVICE_ROLE_KEY',
    rotulo: 'Service role key',
    impacto: 'Sem ela: criar conta, redefinir senha, auditoria e todos os crons param.',
    nivel: 'obrigatoria',
  },
  {
    nome: 'CRON_SECRET',
    rotulo: 'Segredo dos crons',
    impacto: 'Sem ela as rotas de cron negam tudo — nenhum e-mail automático sai.',
    nivel: 'obrigatoria',
  },
  {
    nome: 'SMTP_HOST',
    rotulo: 'Servidor SMTP',
    impacto: 'Caminho principal de envio de e-mail.',
    nivel: 'alternativa',
    grupo: 'E-mail',
  },
  {
    nome: 'SMTP_USER',
    rotulo: 'Usuário SMTP',
    impacto: 'Autenticação do envio por SMTP.',
    nivel: 'alternativa',
    grupo: 'E-mail',
  },
  {
    nome: 'SMTP_PASS',
    rotulo: 'Senha SMTP',
    impacto: 'Autenticação do envio por SMTP.',
    nivel: 'alternativa',
    grupo: 'E-mail',
  },
  {
    nome: 'RESEND_API_KEY',
    rotulo: 'Chave do Resend',
    impacto: 'Caminho alternativo de e-mail, usado quando o SMTP não está configurado.',
    nivel: 'alternativa',
    grupo: 'E-mail',
  },
  {
    nome: 'NEXT_PUBLIC_APP_URL',
    rotulo: 'URL pública do app',
    impacto: 'Os links dentro dos e-mails caem no domínio padrão sem ela.',
    nivel: 'opcional',
  },
  {
    nome: 'EMAIL_FROM',
    rotulo: 'Remetente dos e-mails',
    impacto: 'Sem ela o remetente cai no padrão do código.',
    nivel: 'opcional',
  },
]

/**
 * Espelha exatamente a condição de lib/email.ts: SMTP tem prioridade e exige
 * host + user; senão vale a chave do Resend. Modelar isso como "cada variável
 * é obrigatória" acenderia alarme vermelho num sistema que envia e-mail sem
 * problema nenhum pelo outro caminho.
 */
export function emailConfigurado(presentes: Record<string, boolean>): boolean {
  return (presentes.SMTP_HOST && presentes.SMTP_USER) || presentes.RESEND_API_KEY
}
