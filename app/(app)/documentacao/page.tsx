import { BookOpen, Sparkles, HelpCircle, FileText, History } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentacaoViewer } from './documentacao-viewer'
import { ChangelogViewer } from './changelog-viewer'

export const dynamic = 'force-dynamic'

const FAQS = [
  {
    pergunta: 'Como o tempo cronometrado no Kanban vira apontamento no índice?',
    resposta:
      'Ao pausar o cronômetro de qualquer card, o tempo acumulado na sessão é convertido automaticamente em um apontamento vinculado à demanda associada ao card no dia em que o trabalho aconteceu.',
  },
  {
    pergunta: 'O que acontece se eu esquecer o cronômetro rodando por muitas horas?',
    resposta:
      'Sessões com duração superior à sua carga horária diária são descartadas para impedir a inflação acidental do índice. Nesses casos, basta ajustar o tempo real trabalhado via a opção "Ajustar horas registradas" dentro do card.',
  },
  {
    pergunta: 'Como o Índice Diário de Produtividade é calculado?',
    resposta:
      'O índice é calculado pela divisão do tempo total entregue no dia pela carga horária contratada (ex: 8 horas). Um índice de 100% (1.0) significa que toda a carga horária foi coberta por atividades válidas.',
  },
  {
    pergunta: 'Posso fazer ou editar lançamentos de dias passados?',
    resposta:
      'Não. Para garantir a integridade dos dados, apontamentos manuais só podem ser criados ou editados no próprio dia atual. Apenas o cronômetro do Kanban registra sessões retroativas na data real de execução.',
  },
  {
    pergunta: 'O que é o limite de WIP nas colunas do Kanban?',
    resposta:
      'O limite de WIP (Work In Progress) define o número máximo de cartões permitidos simultaneamente em uma coluna. Se a coluna atingir o limite, novos cartões não poderão ser movidos para ela até que os existentes sejam avançados.',
  },
  {
    pergunta: 'Como sugerir uma nova demanda no Catálogo?',
    resposta:
      'Qualquer colaborador pode acessar a tela de Catálogo e clicar em "Sugerir Demanda". A proposta ficará pendente até ser avaliada e aprovada por um gestor da área.',
  },
]

export default async function DocumentacaoPage() {
  await requireUser()

  return (
    <div className="flex flex-col min-h-full min-w-0 overflow-x-hidden p-4 md:p-8 bg-background">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-card border border-border shadow-xs rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Central de <span className="text-primary">Documentação</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Guia operacional completo do Vértice, regras de negócio e histórico de novidades.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-border pt-3 sm:pt-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>v2.4 Estável</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              <span>12 Módulos</span>
            </div>
          </div>
        </div>

        {/* Organized Navigation Tabs */}
        <Tabs defaultValue="guia" className="space-y-6">
          <TabsList className="bg-secondary/60 border border-border p-1 rounded-xl h-auto gap-1">
            <TabsTrigger
              value="guia"
              className="flex items-center gap-2 text-xs sm:text-sm font-bold py-2.5 px-4 rounded-lg data-active:bg-primary data-active:text-primary-foreground transition-all"
            >
              <FileText className="w-4 h-4" />
              Guia do Sistema
            </TabsTrigger>
            <TabsTrigger
              value="novidades"
              className="flex items-center gap-2 text-xs sm:text-sm font-bold py-2.5 px-4 rounded-lg data-active:bg-primary data-active:text-primary-foreground transition-all"
            >
              <History className="w-4 h-4" />
              Novidades & Release Notes
            </TabsTrigger>
            <TabsTrigger
              value="faq"
              className="flex items-center gap-2 text-xs sm:text-sm font-bold py-2.5 px-4 rounded-lg data-active:bg-primary data-active:text-primary-foreground transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              Perguntas Frequentes (FAQ)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guia" className="mt-0 focus-visible:outline-none">
            <DocumentacaoViewer />
          </TabsContent>

          <TabsContent value="novidades" className="mt-0 focus-visible:outline-none">
            <ChangelogViewer />
          </TabsContent>

          <TabsContent value="faq" className="mt-0 focus-visible:outline-none space-y-4">
            <div className="bg-card border border-border shadow-xs rounded-xl p-5 sm:p-7 space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  Dúvidas Frequentes da Operação
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Respostas diretas sobre regras de contagem de tempo, travamentos de segurança e índices.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FAQS.map((faq, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-border/80 bg-secondary/20 p-5 space-y-2.5 hover:bg-secondary/40 transition-colors"
                  >
                    <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-start gap-2">
                      <span className="text-primary font-mono text-xs">Q{index + 1}.</span>
                      {faq.pergunta}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground pl-6">
                      {faq.resposta}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

