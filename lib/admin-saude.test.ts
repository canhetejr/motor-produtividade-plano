import { describe, it, expect } from 'vitest'
import { avaliarCron, emailConfigurado, CRONS_DECLARADOS, ENVS_ESPERADAS } from './admin-saude'

const diario = CRONS_DECLARADOS.find((c) => c.tipo === 'kanban-recorrencia')!
const diasUteis = CRONS_DECLARADOS.find((c) => c.tipo === 'lembrete-diario')!
const semanal = CRONS_DECLARADOS.find((c) => c.tipo === 'relatorio-semanal')!

const agora = new Date('2026-07-31T12:00:00Z')
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000).toISOString()

describe('avaliarCron', () => {
  it('marca como "nunca" quando não há execução registrada', () => {
    const r = avaliarCron(diario, null, agora)
    expect(r.status).toBe('nunca')
    expect(r.horasDesde).toBeNull()
  })

  it('aceita o cron diário que rodou dentro da folga', () => {
    expect(avaliarCron(diario, horasAtras(25), agora).status).toBe('ok')
  })

  it('acusa atraso do cron diário passada a folga', () => {
    expect(avaliarCron(diario, horasAtras(31), agora).status).toBe('atrasado')
  })

  // O caso que faria o painel virar ruído: o cron de dias úteis fica
  // legitimamente 72h parado entre sexta e segunda. Se isso acendesse
  // vermelho, todo fim de semana teria alarme falso e ninguém olharia mais.
  it('não acusa o cron de dias úteis pela parada normal do fim de semana', () => {
    expect(avaliarCron(diasUteis, horasAtras(72), agora).status).toBe('ok')
  })

  it('acusa o cron de dias úteis quando some por mais que o fim de semana', () => {
    expect(avaliarCron(diasUteis, horasAtras(96), agora).status).toBe('atrasado')
  })

  it('não acusa o semanal pelo intervalo normal de 7 dias', () => {
    expect(avaliarCron(semanal, horasAtras(168), agora).status).toBe('ok')
  })

  it('acusa o semanal quando pula uma semana', () => {
    expect(avaliarCron(semanal, horasAtras(200), agora).status).toBe('atrasado')
  })

  it('toda tolerância declarada cobre o maior intervalo normal da própria agenda', () => {
    // Trava de regressão: mexer numa agenda no vercel.json sem revisar a
    // tolerância aqui produziria alarme permanente numa tela de saúde.
    for (const cron of CRONS_DECLARADOS) {
      const diario = cron.agenda.endsWith('* * *')
      const semanal = /\* \* [0-6]$/.test(cron.agenda)
      const minimoEsperado = semanal ? 168 : diario ? 24 : 72
      expect(cron.toleranciaHoras).toBeGreaterThan(minimoEsperado)
    }
  })
})

describe('emailConfigurado', () => {
  // Espelha lib/email.ts: SMTP precisa de host + user; senão vale o Resend.
  it('aceita SMTP completo', () => {
    expect(emailConfigurado({ SMTP_HOST: true, SMTP_USER: true, RESEND_API_KEY: false })).toBe(true)
  })

  it('recusa SMTP pela metade', () => {
    expect(emailConfigurado({ SMTP_HOST: true, SMTP_USER: false, RESEND_API_KEY: false })).toBe(false)
  })

  it('aceita só o Resend', () => {
    expect(emailConfigurado({ SMTP_HOST: false, SMTP_USER: false, RESEND_API_KEY: true })).toBe(true)
  })

  it('recusa quando não há caminho nenhum', () => {
    expect(emailConfigurado({ SMTP_HOST: false, SMTP_USER: false, RESEND_API_KEY: false })).toBe(false)
  })

  it('não trata as variáveis de e-mail como obrigatórias isoladamente', () => {
    // O que importa é que nenhuma delas seja 'obrigatoria': isso acenderia
    // alarme vermelho num sistema que envia e-mail sem problema nenhum pelo
    // outro caminho. O grupo mistura dois papéis de propósito — as quatro que
    // formam os dois caminhos são 'alternativa', e os ajustes finos de SMTP
    // (porta, TLS, remetente) são 'opcional', porque têm padrão no código.
    const email = ENVS_ESPERADAS.filter((e) => e.grupo === 'E-mail')
    expect(email.length).toBeGreaterThan(0)
    expect(email.some((e) => e.nivel === 'obrigatoria')).toBe(false)

    const caminhos = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY']
    expect(
      email.filter((e) => caminhos.includes(e.nome)).map((e) => e.nivel)
    ).toEqual(caminhos.map(() => 'alternativa'))
  })

  it('audita as variáveis lidas por índice dinâmico', () => {
    // GOOGLE_* são lidas como process.env[name] em lib/google-workspace.ts, o
    // que as esconde de qualquer varredura por `process.env.NOME`. Ficaram
    // fora deste painel desde sempre — e o console dizia "nenhuma pendência"
    // com a integração inteira sem configurar. Este teste existe para que
    // sumirem da lista seja uma decisão, não um descuido.
    const nomes = ENVS_ESPERADAS.map((e) => e.nome)
    for (const nome of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_TOKEN_ENCRYPTION_KEY']) {
      expect(nomes).toContain(nome)
    }
  })
})
