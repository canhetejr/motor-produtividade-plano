import { cn } from '@/lib/utils'

/**
 * Maquete do Kanban do Vértice para a landing — HTML/CSS puro, sem print de
 * tela e sem dado real de cliente. Existe porque a landing descrevia o
 * produto sem nunca deixar ver: mostrar a interface é o que separa uma
 * página que explica de uma que convence.
 *
 * É maquete, não o componente real: importar o Kanban de verdade traria
 * dnd-kit, TipTap e o client Supabase para uma página que precisa ser
 * estática. O compromisso é ser fiel ao que o produto realmente mostra —
 * código do cartão, prioridade, prazo, responsável, etiqueta e coluna são
 * todos campos que existem de fato.
 */

type Cartao = {
  codigo: string
  titulo: string
  responsavel: string
  prazo?: string
  prioridade?: 'alta' | 'media'
  etiqueta?: { nome: string; cor: string }
}

const COLUNAS: { nome: string; cartoes: Cartao[]; limite?: string }[] = [
  {
    nome: 'A fazer',
    cartoes: [
      {
        codigo: 'QEAD-142',
        titulo: 'Revisar trilha de Matemática Básica',
        responsavel: 'MF',
        prazo: '12 ago',
        etiqueta: { nome: 'Conteúdo', cor: 'var(--v-mint)' },
      },
      {
        codigo: 'QEAD-147',
        titulo: 'Padronizar capas dos módulos',
        responsavel: 'TR',
        etiqueta: { nome: 'Design', cor: 'var(--v-purple)' },
      },
    ],
  },
  {
    nome: 'Em andamento',
    limite: '3 de 5',
    cartoes: [
      {
        codigo: 'MOODLE-88',
        titulo: 'Migrar turmas do semestre para o novo ambiente',
        responsavel: 'LS',
        prazo: 'hoje',
        prioridade: 'alta',
        etiqueta: { nome: 'Operação', cor: '#f59e0b' },
      },
      {
        codigo: 'QEAD-139',
        titulo: 'Ajustar rubrica de correção',
        responsavel: 'CF',
        prazo: '10 ago',
      },
    ],
  },
  {
    nome: 'Aprovação',
    cartoes: [
      {
        codigo: 'QEAD-131',
        titulo: 'Roteiro do vídeo de abertura',
        responsavel: 'AB',
        prioridade: 'media',
        etiqueta: { nome: 'Audiovisual', cor: 'var(--v-purple)' },
      },
    ],
  },
  {
    nome: 'Concluído',
    cartoes: [
      {
        codigo: 'QEAD-128',
        titulo: 'Publicar banco de questões',
        responsavel: 'WN',
      },
    ],
  },
]

export function PreviewKanban({ className }: { className?: string }) {
  return (
    // Rola na horizontal em tela estreita em vez de espremer 4 colunas em
    // 390px (onde o título do cartão vira uma palavra por linha e nada se
    // lê). É também como o Kanban de verdade se comporta no celular.
    <div className={cn('-mx-1 flex gap-3 overflow-x-auto px-1 pb-1', className)}>
      {COLUNAS.map((coluna) => (
        <div key={coluna.nome} className="flex w-[172px] shrink-0 flex-col gap-2 sm:w-auto sm:flex-1">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <span className="truncate text-[11px] font-semibold text-white/80">{coluna.nome}</span>
            <span className="shrink-0 font-mono text-[9px] text-white/35">
              {coluna.limite ?? coluna.cartoes.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {coluna.cartoes.map((cartao) => (
              <article
                key={cartao.codigo}
                className="rounded-md border border-white/10 bg-white/[0.04] p-2.5 shadow-[0_1px_2px_rgba(0,0,0,.4)]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[9px] text-white/40">{cartao.codigo}</span>
                  {cartao.prioridade === 'alta' && (
                    <span className="rounded-sm bg-rose-500/15 px-1 py-px text-[8px] font-bold uppercase text-rose-300">
                      Urgente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-medium leading-snug text-white/90">{cartao.titulo}</p>
                {cartao.etiqueta && (
                  <span
                    className="mt-1.5 inline-block rounded-sm px-1.5 py-px text-[8px] font-semibold"
                    style={{
                      color: cartao.etiqueta.cor,
                      backgroundColor: `color-mix(in oklch, ${cartao.etiqueta.cor}, transparent 86%)`,
                    }}
                  >
                    {cartao.etiqueta.nome}
                  </span>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/25 font-mono text-[8px] font-bold text-white/80">
                    {cartao.responsavel}
                  </span>
                  {cartao.prazo && (
                    <span
                      className={cn(
                        'font-mono text-[9px]',
                        cartao.prazo === 'hoje' ? 'text-amber-300' : 'text-white/40'
                      )}
                    >
                      {cartao.prazo}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
