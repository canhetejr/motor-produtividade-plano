export const metadata = {
  title: 'Termos de Serviço — Vértice',
}

const SECOES = [
  {
    titulo: '1. Aceitação dos termos',
    paragrafos: [
      'Estes Termos de Serviço regem o uso do Vértice, produto da Tera disponibilizado em vertice.teralabs.cloud. Ao criar uma conta ou usar o serviço, você concorda com estes termos em nome próprio e, quando aplicável, em nome da empresa que representa.',
      'Se você não concorda com algum ponto, não utilize o Vértice.',
    ],
  },
  {
    titulo: '2. O que é o serviço',
    paragrafos: [
      'O Vértice é um software de gestão de produtividade: apontamento de horas, quadro Kanban, dashboards, metas e relatórios, oferecido como SaaS multi-inquilino — cada empresa cliente (organização) acessa apenas os próprios dados.',
      'Novas funcionalidades lançadas depois da sua adesão também se sujeitam a estes termos, salvo aviso em contrário.',
    ],
  },
  {
    titulo: '3. Cadastro, conta e teste grátis',
    paragrafos: [
      'O cadastro cria uma organização com um período de teste gratuito de 14 dias, sem necessidade de cartão de crédito. Ao final do teste, a continuidade do uso depende de acordo comercial com a Tera.',
      'Você é responsável por manter a confidencialidade das credenciais de acesso e por toda atividade realizada na sua conta. Cada pessoa pertence a uma única organização por vez.',
      'Gestores da organização podem convidar, gerenciar e remover colaboradores, e são responsáveis por garantir que essas pessoas estejam cientes destes termos.',
    ],
  },
  {
    titulo: '4. Uso aceitável',
    paragrafos: [
      'Você concorda em não: (a) tentar acessar dados de outra organização; (b) usar o serviço para fins ilícitos; (c) tentar burlar limites técnicos, de assentos ou de segurança; (d) fazer engenharia reversa do software; (e) sobrecarregar a infraestrutura de forma intencional, incluindo abuso de integrações e da API/MCP.',
      'A Tera pode suspender contas que violem este uso aceitável, avisando quando a situação permitir.',
    ],
  },
  {
    titulo: '5. Propriedade intelectual',
    paragrafos: [
      'O Vértice, sua marca, design e código-fonte pertencem à Tera. Estes termos não transferem nenhuma propriedade intelectual — você recebe apenas uma licença de uso, não exclusiva e intransferível, para acessar o serviço enquanto sua conta estiver ativa.',
      'Os dados que você insere no Vértice (apontamentos, cartões, comentários, anexos) continuam sendo seus. A Tera não reivindica propriedade sobre esse conteúdo.',
    ],
  },
  {
    titulo: '6. Dados e privacidade',
    paragrafos: [
      'O tratamento de dados pessoais no Vértice segue a Política de Privacidade, parte integrante destes termos.',
    ],
  },
  {
    titulo: '7. Disponibilidade e alterações no serviço',
    paragrafos: [
      'A Tera busca manter o Vértice disponível de forma contínua, mas não garante ausência de interrupções — para manutenção, correções ou motivos fora do controle razoável da empresa.',
      'Funcionalidades podem ser adicionadas, alteradas ou descontinuadas ao longo do tempo, com aviso prévio quando a mudança afetar uso essencial já contratado.',
    ],
  },
  {
    titulo: '8. Limitação de responsabilidade',
    paragrafos: [
      'O Vértice é fornecido "como está". Na máxima extensão permitida por lei, a Tera não se responsabiliza por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso do serviço, ressalvados os casos de dolo ou culpa grave.',
      'Cabe a você manter backups próprios de informações críticas, além dos mecanismos de exportação (CSV, XLSX, PDF) já oferecidos pelo Vértice.',
    ],
  },
  {
    titulo: '9. Cancelamento e rescisão',
    paragrafos: [
      'Você pode encerrar o uso do Vértice a qualquer momento, entrando em contato com vendas@teralabs.cloud.',
      'A Tera pode suspender ou encerrar contas em caso de violação destes termos, inadimplência ou por decisão de descontinuar o serviço, com aviso prévio razoável sempre que possível.',
    ],
  },
  {
    titulo: '10. Alterações nestes termos',
    paragrafos: [
      'Estes termos podem ser atualizados para refletir mudanças no serviço ou na legislação aplicável. Alterações relevantes serão comunicadas pelos canais habituais de contato com sua organização.',
    ],
  },
  {
    titulo: '11. Lei aplicável',
    paragrafos: [
      'Estes termos são regidos pelas leis brasileiras. Eventuais controvérsias serão submetidas ao foro do domicílio da Tera, salvo disposição contratual específica em contrário.',
    ],
  },
  {
    titulo: '12. Contato',
    paragrafos: [
      'Dúvidas sobre estes termos podem ser enviadas para vendas@teralabs.cloud.',
    ],
  },
]

export default function TermosPage() {
  return (
    <section className="px-6 pt-32 pb-20">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-12">
          <p className="font-mono text-sm font-medium text-vertice-mint">Legal</p>
          <h1 className="mt-3 font-heading text-4xl font-medium">Termos de Serviço</h1>
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
          Veja também a{' '}
          <a href="/privacidade" className="text-vertice-mint hover:underline">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </section>
  )
}
