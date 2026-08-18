import { BookOpen, Sparkles, HelpCircle, FileText, History } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentacaoViewer } from './documentacao-viewer'
import { ChangelogViewer } from './changelog-viewer'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { DOCUMENTACAO } from '@/lib/documentacao'
import { entradasDoChangelog, VERSAO_ATUAL } from '@/lib/changelog'

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
    pergunta: 'Como sugerir uma nova demanda?',
    resposta:
      'Qualquer colaborador pode acessar "Minhas demandas" e clicar em "Sugerir nova demanda". A proposta ficará pendente até ser avaliada e aprovada por um gestor da área.',
  },
]

export default async function DocumentacaoPage() {
  const { profile } = await requireUser()
  const podeVerGestao = profile.role === 'gestor'
  const entradas = entradasDoChangelog(podeVerGestao ? 'gestao' : 'equipe')

  return (
    <PageShell contentClassName="space-y-6">
        <PageHeader
          title="Central de ajuda"
          description="Guia operacional do Vértice, regras de negócio e histórico de novidades."
          icon={BookOpen}
          className="mb-0"
          actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>v{VERSAO_ATUAL} Estável</span>
            </div>
            {/* Derivado do próprio guia. Estava fixo em 12 com 14 seções no
                ar — um número que só envelhece, e cuja única função é dizer
                quanto material existe. */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              <span>{DOCUMENTACAO.length} módulos</span>
            </div>
          </div>
          }
        />

        {/* Organized Navigation Tabs */}
        <Tabs defaultValue="guia" className="space-y-6">
          <TabsList className="bg-secondary/60 border border-border p-1 rounded-md h-auto gap-1">
            <TabsTrigger
              value="guia"
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all data-active:bg-primary data-active:text-primary-foreground"
            >
              <FileText className="w-4 h-4" />
              Guia do sistema
            </TabsTrigger>
            <TabsTrigger
              value="novidades"
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all data-active:bg-primary data-active:text-primary-foreground"
            >
              <History className="w-4 h-4" />
              Novidades
            </TabsTrigger>
            <TabsTrigger
              value="faq"
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all data-active:bg-primary data-active:text-primary-foreground"
            >
              <HelpCircle className="w-4 h-4" />
              Perguntas frequentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guia" className="mt-0 focus-visible:outline-none">
            <DocumentacaoViewer />
          </TabsContent>

          <TabsContent value="novidades" className="mt-0 focus-visible:outline-none">
            <ChangelogViewer entradas={entradas} podeVerGestao={podeVerGestao} />
          </TabsContent>

          <TabsContent value="faq" className="mt-0 focus-visible:outline-none space-y-4">
            <section className="space-y-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  Dúvidas frequentes da operação
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Respostas diretas sobre regras de contagem de tempo, travamentos de segurança e índices.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FAQS.map((faq, index) => (
                  <div
                    key={index}
                    className="space-y-2.5 rounded-md border border-border/80 bg-card p-5 transition-colors hover:bg-muted/40"
                  >
                    <h3 className="flex items-start gap-2 text-sm font-semibold text-foreground">
                      <span className="text-primary font-mono text-xs">Q{index + 1}.</span>
                      {faq.pergunta}
                    </h3>
                    <p className="pl-6 text-sm leading-relaxed text-muted-foreground">
                      {faq.resposta}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>
        </Tabs>
    </PageShell>
  )
}
