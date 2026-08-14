'use client'

import { motion, useTransform, type MotionValue } from 'framer-motion'
import { AlertTriangle, FileSpreadsheet, StickyNote, type LucideIcon } from 'lucide-react'

import { useMovimentoReduzido } from '@/lib/landing/movimento-reduzido'
import { JANELA_DADOS } from '@/lib/landing/movimento'
import { cn } from '@/lib/utils'
import { useCapituloAtual } from './ato'

/**
 * O contraste "sem o Vértice / com o Vértice", contado por composição em vez de
 * por duas listas lado a lado.
 *
 * O lado "sem" não é feio — é desalinhado. Cada peça tem a própria rotação, a
 * própria largura e o próprio recuo, como informação que existe mas não
 * conversa. A intenção é que o desconforto seja sentido antes de o texto ser
 * lido.
 *
 * O lado "com" faz o movimento inverso na seção seguinte: as peças chegam a uma
 * grade exata e o movimento desacelera até parar. Os dois capítulos juntos são
 * a transição — nenhum deles funciona sozinho.
 */

type ItemSem = { icone: LucideIcon; texto: string; rot: number; x: number; largura: string }

const SEM: readonly ItemSem[] = [
  {
    icone: FileSpreadsheet,
    texto: 'Planilha que só o autor entende, atualizada de memória na sexta',
    rot: -1.6,
    x: -14,
    largura: '96%',
  },
  {
    icone: AlertTriangle,
    texto: 'Ninguém sabe quem está sobrecarregado até alguém estourar o prazo',
    rot: 1.1,
    x: 22,
    largura: '88%',
  },
  {
    icone: StickyNote,
    texto: 'Relatório de produtividade custa uma tarde de exportação e fórmula',
    rot: -0.7,
    x: -6,
    largura: '92%',
  },
]

export function SemVertice({ className }: { className?: string }) {
  const { visivel } = useCapituloAtual()
  // A desordem *aumenta* de leve com a rolagem, em vez de se resolver: este é
  // o capítulo do problema, e resolvê-lo aqui roubaria a virada do próximo.
  const desordem = useTransform(visivel, [0.1, 0.8], [0.75, 1.15], { clamp: true })

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {SEM.map((item) => (
        <PecaSolta key={item.texto} item={item} desordem={desordem} />
      ))}
    </div>
  )
}

function PecaSolta({ item, desordem }: { item: ItemSem; desordem: MotionValue<number> }) {
  const reduzir = useMovimentoReduzido()
  // Com movimento reduzido o desalinhamento fica estático em vez de sumir: a
  // desordem é o conteúdo deste bloco, não um efeito. O que se remove é o
  // movimento, não a mensagem.
  const rotacao = useTransform(desordem, (d) => item.rot * (reduzir ? 1 : d))
  const deslocamento = useTransform(desordem, (d) => item.x * (reduzir ? 1 : d))
  const Icone = item.icone

  return (
    <motion.div
      className="relative rounded-md border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm"
      style={{ width: item.largura, rotate: rotacao, x: deslocamento }}
    >
      <div className="flex items-start gap-2.5">
        <Icone className="mt-0.5 size-4 shrink-0 text-white/30" aria-hidden />
        <span className="text-sm leading-6 text-white/55">{item.texto}</span>
      </div>
    </motion.div>
  )
}

const COM = [
  { texto: 'Apontamento de dois minutos, índice calculado sozinho', dado: '2 min' },
  { texto: 'Capacidade da equipe visível todo dia, antes de virar problema', dado: 'hoje' },
  { texto: 'Relatório semanal pronto, no e-mail de quem precisa ver', dado: 'seg 08h' },
] as const

export function ComVertice({ className }: { className?: string }) {
  return (
    // Superfície própria, como os outros painéis de produto: sem ela o campo 3D
    // aparece por trás das linhas e o bloco que deveria significar "ordem" fica
    // sendo o mais bagunçado da tela.
    <div
      className={cn(
        'overflow-hidden rounded-md border border-primary/25 bg-[#08070f]/80 backdrop-blur-md',
        className
      )}
    >
      {COM.map((item, i) => (
        <LinhaAlinhada key={item.texto} texto={item.texto} dado={item.dado} ordem={i} />
      ))}
    </div>
  )
}

function LinhaAlinhada({ texto, dado, ordem }: { texto: string; dado: string; ordem: number }) {
  const { visivel } = useCapituloAtual()
  const reduzir = useMovimentoReduzido()
  // Cada linha encontra a própria posição um instante depois da anterior, e o
  // deslocamento é curto: aqui o movimento desacelera até o repouso, que é o
  // oposto do capítulo anterior.
  const inicio = JANELA_DADOS.inicio + ordem * JANELA_DADOS.escalonamento
  const fim = JANELA_DADOS.fim + ordem * JANELA_DADOS.escalonamento
  const avanco = useTransform(visivel, [inicio, fim], [0, 1], { clamp: true })
  // Mesma regra do resto da landing: nunca trocar a forma do que é renderizado
  // por causa de uma preferência que só o cliente conhece — a hidratação
  // manteria o estilo do servidor e a linha ficaria invisível. Troca-se o
  // valor: com movimento reduzido ela nasce no lugar, opaca.
  const y = useTransform(avanco, (v) => (reduzir ? 0 : (1 - v) * 16))
  const opacidade = useTransform(avanco, (v) => (reduzir ? 1 : Math.min(v * 2, 1)))

  return (
    <motion.div
      className="flex items-center justify-between gap-4 border-b border-primary/12 px-4 py-3.5 last:border-b-0"
      style={{ y, opacity: opacidade }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
        <span className="text-sm leading-6 text-white/85">{texto}</span>
      </div>
      <span className="shrink-0 font-mono text-3xs tabular-nums text-primary">{dado}</span>
    </motion.div>
  )
}
