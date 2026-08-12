'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, KeyRound, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { EstadoBadge } from '@/components/ui/estado-badge'
import { criarMcpToken, revogarMcpToken } from './mcp-actions'
import type { EscopoMcp } from '@/lib/mcp-auth'

export type McpTokenListado = {
  id: string
  nome: string
  tokenPrefixo: string
  escopos: string[]
  criadoEm: string
  ultimoUsoEm: string | null
  expiraEm: string | null
}

const ESCOPO_LABEL: Record<EscopoMcp, string> = {
  'apontamento:leitura': 'Ver apontamentos',
  'apontamento:escrita': 'Registrar apontamentos',
  'kanban:leitura': 'Ver cartões do kanban',
  'kanban:escrita': 'Mover cartões do kanban',
}

const ESCOPOS: EscopoMcp[] = ['apontamento:leitura', 'apontamento:escrita', 'kanban:leitura', 'kanban:escrita']

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function McpTokensManager({ tokens }: { tokens: McpTokenListado[] }) {
  const [isPending, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [escoposSelecionados, setEscoposSelecionados] = useState<EscopoMcp[]>([])
  const [tokenGerado, setTokenGerado] = useState<string | null>(null)

  const copiar = async (valor: string) => {
    try {
      await navigator.clipboard.writeText(valor)
      toast.success('Token copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  const alternarEscopo = (escopo: EscopoMcp) => {
    setEscoposSelecionados((atual) => (atual.includes(escopo) ? atual.filter((e) => e !== escopo) : [...atual, escopo]))
  }

  const criar = () => {
    if (!nome.trim()) {
      toast.error('Dê um nome ao token.')
      return
    }
    if (escoposSelecionados.length === 0) {
      toast.error('Selecione ao menos uma permissão.')
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.append('nome', nome)
      escoposSelecionados.forEach((e) => formData.append('escopos', e))

      const res = await criarMcpToken(formData)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setTokenGerado(res.data?.token ?? null)
      setAberto(false)
      setNome('')
      setEscoposSelecionados([])
    })
  }

  const revogar = (id: string, tokenNome: string) => {
    startTransition(async () => {
      const res = await revogarMcpToken(id)
      if (res.ok) toast.success(`Token "${tokenNome}" revogado.`)
      else toast.error(res.error)
    })
  }

  return (
    <section className="mt-6 rounded-md border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Acesso via MCP</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere um token para conectar um agente de IA (Claude Desktop, Claude Code) ao Vértice em seu nome.
          </p>
        </div>
        {!aberto && (
          <Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="size-4" /> Novo token
          </Button>
        )}
      </div>

      {aberto && (
        <div className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-1.5">
            <Label htmlFor="mcp-nome">Nome</Label>
            <Input
              id="mcp-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder='Ex.: "Claude Desktop"'
              maxLength={80}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label>Permissões</Label>
            {ESCOPOS.map((escopo) => (
              <label key={escopo} className="flex items-center gap-2 text-sm">
                <Checkbox checked={escoposSelecionados.includes(escopo)} onCheckedChange={() => alternarEscopo(escopo)} />
                {ESCOPO_LABEL[escopo]}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={criar} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Gerar token'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {tokenGerado && (
        <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 p-3">
          <p className="text-sm font-medium">Token gerado</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Copie agora — por segurança, ele não será mostrado de novo. Cole no cliente MCP como a variável de
            configuração do Vértice.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm bg-muted px-2 py-1.5 font-mono text-xs">{tokenGerado}</code>
            <Button size="sm" variant="outline" onClick={() => copiar(tokenGerado)}>
              <Copy className="size-3.5" /> Copiar
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {tokens.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.nome}</p>
              <p className="text-xs text-muted-foreground">
                {t.tokenPrefixo}… · criado em {formatarData(t.criadoEm)}
                {t.ultimoUsoEm ? ` · último uso em ${formatarData(t.ultimoUsoEm)}` : ' · nunca usado'}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {t.escopos.map((e) => (
                  <EstadoBadge key={e} estado="neutro" tamanho="sm">
                    {ESCOPO_LABEL[e as EscopoMcp] ?? e}
                  </EstadoBadge>
                ))}
              </div>
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => revogar(t.id, t.nome)}
              disabled={isPending}
              aria-label={`Revogar token ${t.nome}`}
            >
              <X className="size-3.5" /> Revogar
            </Button>
          </li>
        ))}
      </ul>

      {tokens.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum token ativo.</p>
      )}
    </section>
  )
}
