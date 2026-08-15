'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { alternarFormularioAtivo, excluirFormulario, criarWebhookFormulario, revogarWebhookFormulario } from '../actions'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Link as LinkIcon, Copy, Pencil, Trash2, FileText, Webhook, X } from 'lucide-react'
import { FormularioBuilderDialog } from './formulario-builder-dialog'
import type { Coluna, Formulario } from './types'

export function FormulariosManager({
  quadroId,
  formularios,
  colunas,
}: {
  quadroId: string
  formularios: Formulario[]
  colunas: Coluna[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editando, setEditando] = useState<Formulario | null>(null)
  const [webhookAberto, setWebhookAberto] = useState<string | null>(null)
  // Só existe entre "gerar" e sair do painel — o segredo em claro nunca é
  // guardado além disso, mesmo padrão de McpTokensManager.
  const [tokensGerados, setTokensGerados] = useState<Record<string, string>>({})

  function copiarLink(slug: string) {
    const url = `${window.location.origin}/formularios/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  function copiar(valor: string, mensagem: string) {
    navigator.clipboard.writeText(valor)
    toast.success(mensagem)
  }

  function toggleAtivo(f: Formulario) {
    startTransition(async () => {
      const result = await alternarFormularioAtivo(f.id, quadroId, !f.ativo)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirFormulario(id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Formulário excluído.')
      router.refresh()
    })
  }

  function gerarWebhook(f: Formulario) {
    startTransition(async () => {
      const result = await criarWebhookFormulario(f.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const token = result.data?.token
      if (!token) return
      setTokensGerados((atual) => ({ ...atual, [f.id]: token }))
      router.refresh()
    })
  }

  function revogarWebhook(f: Formulario) {
    startTransition(async () => {
      const result = await revogarWebhookFormulario(f.id, quadroId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setTokensGerados((atual) => {
        const resto = { ...atual }
        delete resto[f.id]
        return resto
      })
      toast.success('Webhook revogado.')
      router.refresh()
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Formulários públicos</h2>
          <p className="text-xs text-muted-foreground">
            Cada formulário gera um link externo (sem login) que cria um card automaticamente ao ser enviado — ou um
            webhook, pra criar card a partir de uma automação (ex. n8n).
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditando(null); setBuilderOpen(true) }}>
          <Plus className="h-3.5 w-3.5" /> Novo formulário
        </Button>
      </div>

      {formularios.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum formulário criado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formularios.map((f) => {
            const coluna = colunas.find((c) => c.id === f.coluna_id)
            const tokenGerado = tokensGerados[f.id]
            const endpointWebhook = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/formularios` : '/api/webhooks/formularios'
            const payloadExemplo = JSON.stringify(
              { respostas: Object.fromEntries(f.campos.map((c) => [c.rotulo, ''])) },
              null,
              2
            )
            return (
              <div key={f.id} className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="font-semibold text-sm truncate">{f.titulo}</h3>
                  </div>
                  <Switch aria-label={`${f.ativo ? 'Desativar' : 'Ativar'} formulário ${f.titulo}`} checked={f.ativo} onCheckedChange={() => toggleAtivo(f)} disabled={isPending} />
                </div>
                {f.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{f.descricao}</p>}
                <div className="text-2xs text-muted-foreground">
                  Cria card em <span className="font-medium text-foreground">{coluna?.nome ?? '—'}</span> · {f.campos.length} campo(s)
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-2xs text-muted-foreground">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate flex-1 font-mono">/formularios/{f.slug}</span>
                  <button type="button" onClick={() => copiarLink(f.slug)} aria-label={`Copiar link de ${f.titulo}`} className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-primary hover:bg-primary/10 hover:text-primary/80 md:size-8">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-2xs text-muted-foreground">
                  <Webhook className="h-3 w-3 shrink-0" />
                  <span className="flex-1">
                    Webhook {f.webhookAtivo ? <span className="font-medium text-foreground">ativo</span> : 'desativado'}
                    {f.webhookTokenPrefixo && <span className="font-mono"> · {f.webhookTokenPrefixo}…</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWebhookAberto((atual) => (atual === f.id ? null : f.id))}
                    className="rounded-md px-2 py-1 text-primary hover:bg-primary/10"
                  >
                    {webhookAberto === f.id ? 'Fechar' : 'Gerenciar'}
                  </button>
                </div>

                {webhookAberto === f.id && (
                  <div className="rounded-md border border-border bg-background p-3 space-y-2.5">
                    {tokenGerado ? (
                      <div className="rounded-md border border-primary/25 bg-primary/5 p-2.5">
                        <p className="text-xs font-medium">Token gerado</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground">
                          Copie agora — por segurança, não será mostrado de novo.
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <code className="min-w-0 flex-1 truncate rounded-sm bg-muted px-2 py-1 font-mono text-2xs">{tokenGerado}</code>
                          <Button size="xs" variant="outline" onClick={() => copiar(tokenGerado, 'Token copiado.')}>
                            <Copy className="size-3" /> Copiar
                          </Button>
                        </div>
                      </div>
                    ) : f.webhookAtivo ? (
                      <p className="text-2xs text-muted-foreground">
                        Webhook ativo. O token em claro só aparece uma vez, na criação — gere um novo se precisar
                        reconfigurar a automação.
                      </p>
                    ) : (
                      <p className="text-2xs text-muted-foreground">
                        Gere um token para deixar uma automação (n8n, por exemplo) criar cards neste formulário via
                        POST, sem precisar preencher a página pública.
                      </p>
                    )}

                    <div className="space-y-1">
                      <p className="text-2xs font-medium text-muted-foreground">Endpoint (POST)</p>
                      <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                        <code className="min-w-0 flex-1 truncate font-mono text-2xs">{endpointWebhook}</code>
                        <button type="button" onClick={() => copiar(endpointWebhook, 'Endpoint copiado.')} aria-label="Copiar endpoint" className="text-muted-foreground hover:text-primary">
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-2xs font-medium text-muted-foreground">
                        Header <code className="font-mono">Authorization</code>
                      </p>
                      <code className="block rounded-md bg-muted px-2 py-1 font-mono text-2xs">Bearer &lt;token&gt;</code>
                    </div>

                    <div className="space-y-1">
                      <p className="text-2xs font-medium text-muted-foreground">Corpo (JSON)</p>
                      <pre className="overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-2xs">{payloadExemplo}</pre>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <Button size="xs" variant="outline" className="flex-1" onClick={() => gerarWebhook(f)} disabled={isPending}>
                        {f.webhookAtivo ? 'Gerar novo token' : 'Gerar webhook'}
                      </Button>
                      {f.webhookAtivo && (
                        <Button size="xs" variant="ghost" onClick={() => revogarWebhook(f)} disabled={isPending}>
                          <X className="size-3" /> Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-auto pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setEditando(f); setBuilderOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="outline" size="icon-sm" aria-label={`Excluir formulário ${f.titulo}`} className="text-muted-foreground hover:text-destructive" />}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{f.titulo}&rdquo; será excluído e o link público deixará de funcionar. Cards já criados não são afetados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant="outline">Cancelar</Button>} />
                        <AlertDialogClose render={<Button variant="destructive" onClick={() => handleExcluir(f.id)}>Excluir</Button>} />
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FormularioBuilderDialog
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open)
          // Fecha depois de criar/editar (ou cancelar) — atualiza a lista
          // buscando o estado novo do servidor (sem realtime nesta tabela).
          if (!open) router.refresh()
        }}
        quadroId={quadroId}
        colunas={colunas}
        formulario={editando}
      />
    </div>
  )
}
