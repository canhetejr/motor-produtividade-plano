'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  updateMeuNome,
  updateMeusDadosGestor,
  updateMeuAvatar,
  updateMinhasNotificacoes,
  updateMinhaSenha,
} from './actions'
import type { Role } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/ui/password-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2,
  Mail,
  Edit2,
  Layers,
  Clock,
  ShieldCheck,
  User,
  KeyRound,
  Camera,
  Sun,
  Moon,
  Monitor,
  Bell,
} from 'lucide-react'

type Area = { id: string; nome: string; ativo: boolean }
type NotifPrefs = {
  notif_lembrete_diario: boolean
  notif_solicitacoes: boolean
  notif_alerta_queda: boolean
  notif_relatorio_semanal: boolean
}

function getInitials(nome: string) {
  const parts = nome.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="gap-2 relative overflow-hidden group" disabled={pending}>
      <div className="absolute inset-0 bg-primary-foreground/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
      <span className="relative flex items-center gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </span>
    </Button>
  )
}

const cardClass = 'bg-card/80 backdrop-blur-xl border shadow-lg rounded-2xl p-6'

export function PerfilManager({
  nome,
  email,
  avatarUrl,
  areaId,
  areaNome,
  areas,
  cargaHorariaMin,
  role,
  notifPrefs,
}: {
  nome: string
  email: string
  avatarUrl: string | null
  areaId: string | null
  areaNome: string | null
  areas: Area[]
  cargaHorariaMin: number
  role: Role
  notifPrefs: NotifPrefs
}) {
  const isGestor = role === 'gestor'
  const { theme, setTheme } = useTheme()

  const [isPendingNome, startNomeTransition] = useTransition()
  const [isPendingDados, startDadosTransition] = useTransition()
  const [isPendingAvatar, startAvatarTransition] = useTransition()
  const [isPendingNotif, startNotifTransition] = useTransition()
  const [isPendingSenha, startSenhaTransition] = useTransition()

  const [editingNome, setEditingNome] = useState(false)
  const [nomeAtual, setNomeAtual] = useState(nome)
  const [editingDados, setEditingDados] = useState(false)
  const [selectedAreaId, setSelectedAreaId] = useState(areaId ?? '')

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleNomeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const novoNome = String(formData.get('nome') ?? '')
    startNomeTransition(async () => {
      const result = await updateMeuNome(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setNomeAtual(novoNome)
      toast.success('Nome atualizado!')
      setEditingNome(false)
    })
  }

  function handleDadosSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('area_id', selectedAreaId)
    startDadosTransition(async () => {
      const result = await updateMeusDadosGestor(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Dados atualizados!')
      setEditingDados(false)
    })
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleAvatarSubmit() {
    if (!avatarFile) return
    const formData = new FormData()
    formData.set('avatar', avatarFile)
    startAvatarTransition(async () => {
      const result = await updateMeuAvatar(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Foto atualizada!')
      setAvatarFile(null)
      setAvatarPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleNotifSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startNotifTransition(async () => {
      const result = await updateMinhasNotificacoes(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Preferências salvas!')
    })
  }

  function handleSenhaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const senha = formData.get('password')
    const confirmacao = formData.get('password_confirm')
    if (senha !== confirmacao) {
      toast.error('As senhas não coincidem.')
      return
    }
    startSenhaTransition(async () => {
      const result = await updateMinhaSenha(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Senha atualizada!')
      form.reset()
    })
  }

  const fotoExibida = avatarPreview ?? avatarUrl

  return (
    <div className="space-y-6">
      {/* Identidade */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cardClass}>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 group/avatar">
            <div className="h-16 w-16 rounded-full bg-linear-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary shadow-sm overflow-hidden">
              {fotoExibida ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoExibida} alt={nomeAtual} className="h-full w-full object-cover" />
              ) : (
                getInitials(nomeAtual)
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
              aria-label="Trocar foto"
            >
              <Camera className="h-3 w-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>

          <div className="flex-1 min-w-0">
            {editingNome ? (
              <form onSubmit={handleNomeSubmit} className="flex items-center gap-2">
                <Input name="nome" defaultValue={nomeAtual} required autoFocus className="h-9" />
                <SubmitButton pending={isPendingNome}>Salvar</SubmitButton>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingNome(false)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 group/nome">
                <h2 className="text-xl font-bold truncate">{nomeAtual}</h2>
                <button
                  type="button"
                  onClick={() => setEditingNome(true)}
                  className="text-muted-foreground hover:text-primary transition-colors opacity-60 group-hover/nome:opacity-100"
                  aria-label="Editar nome"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5 mt-1">
              <Mail className="h-3.5 w-3.5" /> {email}
            </p>
          </div>

          {isGestor ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
              <ShieldCheck className="h-3.5 w-3.5" /> Gestor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border shrink-0">
              <User className="h-3.5 w-3.5" /> Colaborador
            </span>
          )}
        </div>

        {avatarFile && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground flex-1">Nova foto selecionada — {avatarFile.name}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
              Cancelar
            </Button>
            <Button type="button" className="gap-2" disabled={isPendingAvatar} onClick={handleAvatarSubmit}>
              {isPendingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar foto'}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Dados cadastrais */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={cardClass}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Dados Cadastrais</h3>
          {isGestor && !editingDados && (
            <button
              type="button"
              onClick={() => setEditingDados(true)}
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Editar dados cadastrais"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {editingDados ? (
          <form onSubmit={handleDadosSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={selectedAreaId} onValueChange={(val) => setSelectedAreaId(val || '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a área">
                      <span className="truncate block">{areas.find((a) => a.id === selectedAreaId)?.nome ?? 'Selecione a área'}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-carga">Carga horária (min)</Label>
                <Input id="perfil-carga" name="carga_horaria_min" type="number" min="1" defaultValue={cargaHorariaMin} required />
              </div>
            </div>
            <div className="flex gap-2">
              <SubmitButton pending={isPendingDados}>Salvar</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setEditingDados(false)}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Área</p>
                  <p className="font-medium truncate">{areaNome ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Carga horária</p>
                  <p className="font-medium">{cargaHorariaMin} min/dia</p>
                </div>
              </div>
            </div>
            {!isGestor && (
              <p className="text-xs text-muted-foreground mt-4">
                Área e carga horária só podem ser alteradas pelo seu gestor.
              </p>
            )}
          </>
        )}
      </motion.div>

      {/* Aparência */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cardClass}
      >
        <h3 className="text-lg font-bold mb-4">Aparência</h3>
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
      </motion.div>

      {/* Notificações */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cardClass}
      >
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" /> Notificações
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Escolha o que você quer receber.</p>
        <form onSubmit={handleNotifSubmit} className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm">Lembrete diário de apontamento</Label>
              <p className="text-xs text-muted-foreground">E-mail no fim do dia se você ainda não apontou nada.</p>
            </div>
            <Switch name="notif_lembrete_diario" defaultChecked={notifPrefs.notif_lembrete_diario} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm">Solicitações de demanda</Label>
              <p className="text-xs text-muted-foreground">
                {isGestor
                  ? 'Novas sugestões da equipe pra aprovar.'
                  : 'Quando sua sugestão for aprovada ou rejeitada.'}
              </p>
            </div>
            <Switch name="notif_solicitacoes" defaultChecked={notifPrefs.notif_solicitacoes} />
          </div>
          {isGestor && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm">Alerta de queda de produtividade</Label>
                  <p className="text-xs text-muted-foreground">E-mail quando alguém do time cai abaixo de 70% por 2 dias úteis.</p>
                </div>
                <Switch name="notif_alerta_queda" defaultChecked={notifPrefs.notif_alerta_queda} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm">Relatório semanal</Label>
                  <p className="text-xs text-muted-foreground">Resumo por área e colaborador toda segunda-feira.</p>
                </div>
                <Switch name="notif_relatorio_semanal" defaultChecked={notifPrefs.notif_relatorio_semanal} />
              </div>
            </>
          )}
          <SubmitButton pending={isPendingNotif}>Salvar preferências</SubmitButton>
        </form>
      </motion.div>

      {/* Segurança */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cardClass}
      >
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" /> Trocar senha
        </h3>
        <p className="text-sm text-muted-foreground mb-4">Escolha uma nova senha de acesso.</p>
        <form onSubmit={handleSenhaSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perfil-nova-senha">Nova senha</Label>
              <PasswordInput id="perfil-nova-senha" name="password" required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil-confirmar-senha">Confirmar nova senha</Label>
              <PasswordInput id="perfil-confirmar-senha" name="password_confirm" required minLength={6} placeholder="Repita a nova senha" />
            </div>
          </div>
          <SubmitButton pending={isPendingSenha}>Atualizar senha</SubmitButton>
        </form>
      </motion.div>
    </div>
  )
}
