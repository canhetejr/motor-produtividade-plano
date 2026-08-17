export const metadata = {
  title: 'Política de Privacidade — Vértice',
}

const SECOES = [
  {
    titulo: '1. Quem trata os seus dados',
    paragrafos: [
      'O Vértice é operado pela Tera. Esta política explica quais dados pessoais coletamos, para quê e como você pode exercer seus direitos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).',
    ],
  },
  {
    titulo: '2. Dados que coletamos',
    paragrafos: [
      'Dados de cadastro: nome, e-mail, cargo/papel na organização (colaborador ou gestor) e, quando aplicável, avatar.',
      'Dados de uso do produto: apontamentos de horas, cartões de Kanban, comentários, anexos, metas, respostas de formulários e demais informações que você ou sua organização inserem para operar o produto.',
      'Dados técnicos: endereço IP, tipo de dispositivo e navegador, cookies de sessão, e registros de auditoria de ações realizadas no sistema (quem fez o quê e quando), usados para segurança e rastreabilidade.',
      'Integrações opcionais: se você conectar sua conta Google, sincronizamos apenas os eventos de calendário relacionados a cartões do Vértice — nunca lemos o restante da sua agenda ou do seu Drive além do estritamente necessário à integração ativada.',
      'Não coletamos dados sensíveis (saúde, biometria, orientação, etc.) como parte do funcionamento normal do produto.',
    ],
  },
  {
    titulo: '3. Para que usamos seus dados',
    paragrafos: [
      'Para viabilizar o serviço contratado: autenticação, cálculo de índices de produtividade, exibição de dashboards, notificações (in-app, e-mail e push) e geração de relatórios.',
      'Para segurança: autenticação multifator por e-mail (quando ativada), detecção de uso indevido e manutenção da trilha de auditoria.',
      'Para comunicação: avisos operacionais sobre sua conta, lembretes de apontamento e, quando aplicável, contato comercial sobre o plano contratado.',
      'Não vendemos seus dados pessoais nem os usamos para publicidade de terceiros.',
    ],
  },
  {
    titulo: '4. Isolamento entre empresas',
    paragrafos: [
      'O Vértice é multi-inquilino: cada organização cliente só acessa os próprios dados. Essa separação é aplicada em nível de banco de dados (políticas de segurança por linha), não apenas na interface — dados de uma empresa nunca ficam visíveis para outra.',
    ],
  },
  {
    titulo: '5. Com quem compartilhamos dados',
    paragrafos: [
      'Com prestadores que operam a infraestrutura do serviço (hospedagem, banco de dados, envio de e-mail transacional), sob obrigação contratual de confidencialidade e uso restrito à finalidade contratada.',
      'Com o Google, apenas se você ativar a integração de Calendar, e apenas os dados necessários para essa sincronização.',
      'Não compartilhamos seus dados pessoais com terceiros para fins de marketing.',
      'Podemos divulgar dados quando exigido por lei, ordem judicial ou autoridade competente.',
    ],
  },
  {
    titulo: '6. Cookies',
    paragrafos: [
      'Usamos cookies essenciais de sessão para manter você autenticado e lembrar preferências de interface (como tema claro/escuro e cor de destaque). Não usamos cookies de rastreamento publicitário de terceiros.',
    ],
  },
  {
    titulo: '7. Retenção e exclusão',
    paragrafos: [
      'Mantemos seus dados enquanto sua conta e organização estiverem ativas, e pelo tempo adicional necessário para cumprir obrigações legais ou resolver disputas.',
      'Ao excluir um colaborador ou uma demanda, os apontamentos associados são arquivados de forma resumida (para preservar o histórico de produtividade da equipe) antes da remoção dos dados originais.',
      'Você pode solicitar a exclusão definitiva da sua conta e dos dados pessoais associados, respeitadas eventuais obrigações legais de retenção, pelo contato abaixo.',
    ],
  },
  {
    titulo: '8. Segurança',
    paragrafos: [
      'Adotamos controles técnicos e organizacionais para proteger seus dados, incluindo isolamento por organização, trilha de auditoria, autenticação multifator opcional e criptografia em trânsito. Nenhum sistema é 100% imune a incidentes; caso algo relevante ocorra, comunicaremos conforme exigido pela LGPD.',
    ],
  },
  {
    titulo: '9. Seus direitos como titular',
    paragrafos: [
      'Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização ou exclusão dos seus dados pessoais, e revogar consentimentos quando aplicável, entrando em contato pelo e-mail abaixo.',
      'Para dados de uso corporativo (como apontamentos vinculados à sua atividade na empresa), algumas solicitações podem depender também da sua organização, já que ela é a controladora desses registros no dia a dia do trabalho.',
    ],
  },
  {
    titulo: '10. Alterações nesta política',
    paragrafos: [
      'Esta política pode ser atualizada para refletir mudanças no produto ou na legislação. Mudanças relevantes serão comunicadas pelos canais habituais de contato com sua organização.',
    ],
  },
  {
    titulo: '11. Contato',
    paragrafos: [
      'Dúvidas ou solicitações sobre seus dados pessoais podem ser enviadas para vendas@teralabs.cloud.',
    ],
  },
]

export default function PrivacidadePage() {
  return (
    <section className="px-6 pt-32 pb-20">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-12">
          <p className="font-mono text-sm font-medium text-vertice-mint">Legal</p>
          <h1 className="mt-3 font-heading text-4xl font-medium">Política de Privacidade</h1>
          <p className="mt-4 text-sm text-white/50">Última atualização: 17 de agosto de 2026.</p>
        </div>

        <div className="space-y-10">
          {SECOES.map((secao) => (
            <div key={secao.titulo}>
              <h2 className="font-heading text-lg font-semibold text-white">{secao.titulo}</h2>
              <div className="mt-3 space-y-3">
                {secao.paragrafos.map((paragrafo, i) => (
                  <p key={i} className="text-sm leading-7 text-white/70">
                    {paragrafo}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-14 text-sm text-white/50">
          Veja também os{' '}
          <a href="/termos" className="text-vertice-mint hover:underline">
            Termos de Serviço
          </a>
          .
        </p>
      </div>
    </section>
  )
}
