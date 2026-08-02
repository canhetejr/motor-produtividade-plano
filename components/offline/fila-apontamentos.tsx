'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { CloudOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createApontamento } from '@/app/(app)/apontamento/actions'
import {
  contarPendentes,
  lerFila,
  marcarTentativa,
  remover,
  triar,
  type ItemFila,
} from '@/lib/fila-offline'
import { hojeEmSaoPaulo } from '@/lib/semana'

const CHAVE = 'vertice:fila-apontamentos'
const EVENTO = 'vertice:fila-mudou'

function ler(): ItemFila[] {
  return lerFila(localStorage.getItem(CHAVE))
}

function gravar(fila: ItemFila[]) {
  localStorage.setItem(CHAVE, JSON.stringify(fila))
  // `storage` só dispara em outras abas; sem este, a atual não se atualiza.
  window.dispatchEvent(new Event(EVENTO))
}

/**
 * Enfileira um apontamento para envio quando a rede voltar.
 *
 * Chamada pelo formulário quando o envio falha por falta de conexão. Exportada
 * daqui, e não de um módulo de dados, para a chave do armazenamento existir num
 * lugar só.
 */
export function enfileirarApontamento(usuarioId: string, campos: Record<string, string>) {
  const item: ItemFila = {
    id: crypto.randomUUID(),
    data: hojeEmSaoPaulo(),
    usuarioId,
    campos,
    tentativas: 0,
  }
  gravar([...ler(), item])
}

/**
 * Envia o que ficou na fila assim que houver rede.
 *
 * Dispara em três momentos: ao montar (a aba pode ter aberto já online, com
 * fila de uma sessão anterior), no evento `online`, e quando a aba volta a ficar
 * visível — o `online` sozinho não cobre o caso de o aparelho ter reconectado
 * com a tela desligada, que no celular é o caso comum.
 */
function assinarFila(callback: () => void) {
  window.addEventListener(EVENTO, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENTO, callback)
    window.removeEventListener('storage', callback)
  }
}

export function FilaDeApontamentos({ usuarioId }: { usuarioId: string }) {
  const [enviando, setEnviando] = useState(false)

  // useSyncExternalStore em vez de estado + efeito: a fila mora fora do React
  // (localStorage) e o servidor nao a enxerga. Manter um contador em estado
  // exigiria um efeito so para sincroniza-lo, que e o que o
  // react-hooks/set-state-in-effect aponta — e daria hidratacao divergente.
  const bruto = useSyncExternalStore(
    assinarFila,
    () => localStorage.getItem(CHAVE),
    () => null
  )
  const pendentes = bruto === null ? 0 : contarPendentes(lerFila(bruto), usuarioId, hojeEmSaoPaulo())

  const drenar = useCallback(async () => {
    if (!navigator.onLine) return

    const hoje = hojeEmSaoPaulo()
    const { enviar, descartar } = triar(ler(), usuarioId, hoje)

    if (descartar.length > 0) {
      gravar(remover(ler(), descartar.map((i) => i.id)))
      // Descartar em silêncio faria a pessoa acreditar que o apontamento entrou.
      toast.warning(
        descartar.length === 1
          ? '1 apontamento pendente expirou (só se lança no mesmo dia). Refaça se ainda valer.'
          : `${descartar.length} apontamentos pendentes expiraram (só se lança no mesmo dia).`
      )
    }

    if (enviar.length === 0) return

    setEnviando(true)
    const enviados: string[] = []
    const falharam: string[] = []

    // Em série, não em paralelo: a RPC valida teto de blocos acumulado, e
    // mandar tudo de uma vez faria dois itens da mesma demanda passarem pelo
    // limite juntos.
    for (const item of enviar) {
      const formData = new FormData()
      for (const [chave, valor] of Object.entries(item.campos)) formData.set(chave, valor)
      try {
        const resultado = await createApontamento(formData)
        // Erro de regra (demanda inativa, blocos esgotados) não melhora com
        // repetição — sai da fila com aviso, em vez de tentar cinco vezes.
        if (resultado.ok) enviados.push(item.id)
        else {
          enviados.push(item.id)
          toast.error(`Apontamento pendente recusado: ${resultado.error}`)
        }
      } catch {
        falharam.push(item.id)
      }
    }

    let fila = remover(ler(), enviados)
    if (falharam.length > 0) fila = marcarTentativa(fila, falharam)
    gravar(fila)

    setEnviando(false)
    if (enviados.length > 0) {
      toast.success(
        enviados.length === 1
          ? 'Apontamento pendente enviado.'
          : `${enviados.length} apontamentos pendentes enviados.`
      )
    }
  }, [usuarioId])

  useEffect(() => {
    // Agendado, e nao chamado direto: drenar() toca em estado, e faze-lo no
    // corpo do efeito encadeia render durante o commit. Um tick de atraso nao
    // muda nada para quem usa — a fila e assincrona por natureza.
    const inicial = setTimeout(() => void drenar(), 0)

    const aoVoltar = () => void drenar()
    const aoFicarVisivel = () => {
      if (document.visibilityState === 'visible') void drenar()
    }

    window.addEventListener('online', aoVoltar)
    document.addEventListener('visibilitychange', aoFicarVisivel)
    return () => {
      clearTimeout(inicial)
      window.removeEventListener('online', aoVoltar)
      document.removeEventListener('visibilitychange', aoFicarVisivel)
    }
  }, [drenar])

  if (pendentes === 0) return null

  return (
    <div
      role="status"
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-30 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-lg md:bottom-4"
    >
      <span className="flex items-center gap-2">
        {enviando ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {enviando
          ? 'Enviando pendentes…'
          : `${pendentes} apontamento${pendentes > 1 ? 's' : ''} aguardando rede`}
      </span>
    </div>
  )
}
