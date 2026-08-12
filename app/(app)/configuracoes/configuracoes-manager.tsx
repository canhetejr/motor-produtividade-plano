'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Bell, Loader2, Monitor, Moon, Sun } from 'lucide-react'

import { updateMinhasNotificacoes } from '../perfil/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AnimacoesToggle } from '../perfil/animacoes-toggle'
import { BordasToggle } from '../perfil/bordas-toggle'
import { CorToggle } from '../perfil/cor-toggle'
import { CorSecundariaToggle } from '../perfil/cor-secundaria-toggle'
import { ParticulasToggle } from '../perfil/particulas-toggle'
import type { Role } from '@/lib/database.types'

// Os toggles continuam morando em app/(app)/perfil/: eles são componentes de
// preferência que não mudaram de comportamento, só de tela. Movê-los de pasta
// junto com a realocação misturaria "mover arquivo" com "mudar produto" no
// mesmo diff, e a revisão perderia o que importa.

export type NotifPrefs = {
  notif_lembrete_diario: boolean
  notif_solicitacoes: boolean
  notif_alerta_queda: boolean
  notif_relatorio_semanal: boolean
}

const cardClass = 'rounded-md border border-border bg-card p-4 shadow-xs sm:p-5'

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="gap-2" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  )
}

export function ConfiguracoesManager({ role, notifPrefs }: { role: Role; notifPrefs: NotifPrefs }) {
  const isGestor = role === 'gestor'
  const { theme, setTheme } = useTheme()
  const [isPendingNotif, startNotifTransition] = useTransition()

  function handleNotifSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startNotifTransition(async () => {
      const result = await updateMinhasNotificacoes(formData)
      if (result.ok) toast.success('Preferências salvas.')
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-6">
      {/* Aparência */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClass}>
        <h2 className="text-lg font-bold mb-4">Aparência</h2>
        <div className="grid grid-cols-3 gap-2 max-w-sm">
          {([
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Escuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Monitor },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={theme === opt.value}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                theme === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          ))}
        </div>

        <AnimacoesToggle />
        <ParticulasToggle />
        <BordasToggle />
        <CorToggle />
        <CorSecundariaToggle />
      </motion.div>

      {/* Notificações */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cardClass}
      >
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" /> Notificações
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Escolha o que você quer receber.</p>
        <form onSubmit={handleNotifSubmit} className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="config-notif-lembrete" className="text-sm">Lembrete diário de apontamento</Label>
              <p className="text-xs text-muted-foreground">E-mail no fim do dia se você ainda não apontou nada.</p>
            </div>
            <Switch id="config-notif-lembrete" name="notif_lembrete_diario" defaultChecked={notifPrefs.notif_lembrete_diario} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="config-notif-solicitacoes" className="text-sm">Solicitações de demanda</Label>
              <p className="text-xs text-muted-foreground">
                {isGestor
                  ? 'Novas sugestões da equipe pra aprovar.'
                  : 'Quando sua sugestão for aprovada ou rejeitada.'}
              </p>
            </div>
            <Switch id="config-notif-solicitacoes" name="notif_solicitacoes" defaultChecked={notifPrefs.notif_solicitacoes} />
          </div>
          {isGestor && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="config-notif-alerta" className="text-sm">Alerta de queda de produtividade</Label>
                  <p className="text-xs text-muted-foreground">E-mail quando alguém do time cai abaixo de 70% por 2 dias úteis.</p>
                </div>
                <Switch id="config-notif-alerta" name="notif_alerta_queda" defaultChecked={notifPrefs.notif_alerta_queda} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="config-notif-relatorio" className="text-sm">Relatório semanal</Label>
                  <p className="text-xs text-muted-foreground">Resumo por área e colaborador toda segunda-feira.</p>
                </div>
                <Switch id="config-notif-relatorio" name="notif_relatorio_semanal" defaultChecked={notifPrefs.notif_relatorio_semanal} />
              </div>
            </>
          )}
          {/* O formulário envia TODOS os campos de notificação de uma vez, e a
              action lê `=== 'on'`: um switch que não existe na tela (os dois
              de gestor, para colaborador) chega como ausente e vira false.
              Isso é o comportamento correto — colaborador não recebe alerta de
              queda nem relatório semanal — e é o mesmo de antes desta tela
              existir. */}
          <SubmitButton pending={isPendingNotif}>Salvar preferências</SubmitButton>
        </form>
      </motion.div>
    </div>
  )
}
