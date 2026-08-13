'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCheck2, Check, FolderOpen, Loader2, Rocket } from 'lucide-react'

import { concluirSetup } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader, PageShell } from '@/components/layout/page-shell'
import { cn } from '@/lib/utils'

function Passo({
  numero,
  titulo,
  descricao,
  concluido,
  children,
}: {
  numero: number
  titulo: string
  descricao: string
  concluido?: boolean
  children?: React.ReactNode
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
            concluido
              ? 'border-vertice-mint/40 bg-vertice-mint/10 text-vertice-mint'
              : 'border-border bg-muted text-muted-foreground'
          )}
          aria-hidden="true"
        >
          {concluido ? <Check className="size-4" /> : numero}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </section>
  )
}

export function SetupInicial({
  nome,
  organizacaoNome,
  isGestor,
  googleEmail,
  googleDisponivel,
  jaConcluido,
}: {
  nome: string
  organizacaoNome: string
  isGestor: boolean
  googleEmail: string | null
  googleDisponivel: boolean
  jaConcluido: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function finalizar() {
    startTransition(async () => {
      const result = await concluirSetup()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Tudo pronto. Bom trabalho!')
      router.replace('/minha-semana')
    })
  }

  const conectado = Boolean(googleEmail)

  return (
    <PageShell width="content" contentClassName="space-y-5">
      <PageHeader
        title={`Boas-vindas, ${nome.split(' ')[0]}`}
        eyebrow="Primeiros passos"
        description={`Antes de começar no ${organizacaoNome}, conecte suas ferramentas do Google. Leva menos de um minuto e dá para pular — dá para fazer depois em Configurações.`}
        icon={Rocket}
        className="mb-0"
      />

      <Passo
        numero={1}
        titulo="Conectar sua conta Google"
        concluido={conectado}
        descricao={
          conectado
            ? `Conectada como ${googleEmail}. Prazos e arquivos já falam com o Google.`
            : 'Uma autorização só, usada pelas duas integrações abaixo. Você pode desconectar quando quiser.'
        }
      >
        {!googleDisponivel ? (
          <p className="text-sm text-warning-texto">
            A integração com o Google ainda não está configurada neste ambiente. Siga em frente — quem cuida da
            infraestrutura precisa preencher as credenciais do Google antes de este passo funcionar.
          </p>
        ) : conectado ? (
          <form action="/api/google/disconnect" method="post">
            <Button type="submit" variant="outline" size="sm">
              Desconectar
            </Button>
          </form>
        ) : (
          <a href="/api/google/connect" className={buttonVariants()}>
            Conectar conta Google
          </a>
        )}
      </Passo>

      <Passo
        numero={2}
        titulo="Google Calendar"
        concluido={conectado}
        descricao="Com a conta conectada, o prazo de cada cartão em que você é responsável vira um evento no seu calendário — e acompanha as mudanças de data sozinho."
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarCheck2 className="size-4 text-primary" aria-hidden="true" />
          {conectado ? 'Sincronização automática ativa.' : 'Ativa assim que você conectar a conta acima.'}
        </p>
      </Passo>

      <Passo
        numero={3}
        titulo="Google Drive"
        concluido={conectado}
        descricao="O Vértice acessa apenas os arquivos que ele mesmo cria ou que você abre por ele. O resto do seu Drive continua fora do alcance."
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="size-4 text-primary" aria-hidden="true" />
          Permissão restrita a arquivos do app (escopo drive.file).
        </p>
      </Passo>

      {isGestor && (
        <p className="text-sm text-muted-foreground">
          Cada pessoa da equipe conecta a própria conta ao entrar pela primeira vez — não há uma conexão única da
          empresa. Convide o time em <span className="font-medium text-foreground">Gestão › Equipe e acessos</span>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button onClick={finalizar} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {conectado ? 'Concluir e ir para o Vértice' : 'Pular por enquanto'}
        </Button>
        {jaConcluido && (
          <span className="text-sm text-muted-foreground">
            Você já passou por aqui — esta tela fica disponível para revisar as integrações.
          </span>
        )}
      </div>
    </PageShell>
  )
}
