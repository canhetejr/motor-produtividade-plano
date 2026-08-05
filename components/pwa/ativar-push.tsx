'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'

import {
  obterChavePublicaPush,
  registrarInscricaoPush,
  removerInscricaoPush,
} from '@/lib/push-actions'
import { Button } from '@/components/ui/button'

/** A capacidade do navegador não muda: nada a assinar. */
const SEM_MUDANCA = () => () => {}

function temSuportePush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * base64url → bytes, formato que o PushManager exige.
 *
 * O retorno é tipado como ArrayBuffer, e não Uint8Array: o lib.dom atual exige
 * `ArrayBufferView<ArrayBuffer>` e um Uint8Array genérico (sobre
 * `ArrayBufferLike`) não satisfaz — passar o buffer direto evita o atrito sem
 * `as any`.
 */
function paraBytes(base64url: string): ArrayBuffer {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(base64)
  const bytes = new Uint8Array(bruto.length)
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)
  return bytes.buffer
}

function chaveParaBase64(chave: ArrayBuffer | null): string {
  if (!chave) return ''
  return btoa(String.fromCharCode(...new Uint8Array(chave)))
}

/**
 * Liga e desliga a notificação com o app fechado.
 *
 * Não pede permissão sozinho: um pedido de notificação que aparece sem a pessoa
 * ter clicado em nada é negado na hora — e, negado, o navegador não pergunta de
 * novo. O botão existe para o pedido chegar num momento em que faz sentido.
 */
export function AtivarPush() {
  const [inscrito, setInscrito] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  // Suporte do navegador nao e estado — e leitura do ambiente, e nao muda
  // enquanto a pagina vive. useSyncExternalStore com snapshot de servidor
  // `false` evita o setState em efeito e, de quebra, a divergencia de
  // hidratacao: no servidor `navigator` nao existe.
  const suportado = useSyncExternalStore(SEM_MUDANCA, temSuportePush, () => false)

  useEffect(() => {
    if (!suportado) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setInscrito(Boolean(s)))
      .catch(() => {})
  }, [suportado])

  async function ativar() {
    setOcupado(true)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        toast.error(
          permissao === 'denied'
            ? 'Notificações bloqueadas. Libere nas configurações do navegador para este site.'
            : 'Permissão não concedida.'
        )
        return
      }

      const chave = await obterChavePublicaPush()
      if (!chave.ok || !chave.data) {
        toast.error(chave.ok ? 'Servidor sem chave de push.' : chave.error)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const assinatura = await reg.pushManager.subscribe({
        // Obrigatório nos navegadores atuais: push silencioso não é permitido.
        userVisibleOnly: true,
        applicationServerKey: paraBytes(chave.data.chave),
      })

      const resultado = await registrarInscricaoPush({
        endpoint: assinatura.endpoint,
        p256dh: chaveParaBase64(assinatura.getKey('p256dh')),
        auth: chaveParaBase64(assinatura.getKey('auth')),
      })
      if (!resultado.ok) {
        // Sem registro no servidor a inscrição do navegador é inútil e ainda
        // faria o botão mentir que está ligado.
        await assinatura.unsubscribe()
        toast.error(resultado.error)
        return
      }

      setInscrito(true)
      toast.success('Notificações ativadas neste aparelho.')
    } catch (err) {
      console.error('Falha ao ativar push:', err)
      toast.error('Não foi possível ativar as notificações.')
    } finally {
      setOcupado(false)
    }
  }

  async function desativar() {
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const assinatura = await reg.pushManager.getSubscription()
      if (assinatura) {
        await removerInscricaoPush(assinatura.endpoint)
        await assinatura.unsubscribe()
      }
      setInscrito(false)
      toast.success('Notificações desativadas neste aparelho.')
    } finally {
      setOcupado(false)
    }
  }

  if (!suportado) return null

  return (
    <section className="mt-6 rounded-md border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Notificações no aparelho</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Receba aviso de card atribuído e aprovação pendente mesmo com o app
        fechado. Vale só para este aparelho.
      </p>
      <Button
        onClick={inscrito ? desativar : ativar}
        disabled={ocupado}
        variant={inscrito ? 'outline' : 'default'}
        className="mt-3 h-9 gap-2"
      >
        {inscrito ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {ocupado ? 'Aguarde…' : inscrito ? 'Desativar neste aparelho' : 'Ativar notificações'}
      </Button>
    </section>
  )
}
