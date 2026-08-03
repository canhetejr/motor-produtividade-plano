'use client'

import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar'
import { cva, type VariantProps } from 'class-variance-authority'

import { iniciaisDe } from '@/lib/iniciais'
import { cn } from '@/lib/utils'

/**
 * Avatar com recuo para iniciais.
 *
 * A lógica de iniciais estava reescrita em cinco telas, e uma das cópias
 * quebrava com nome de uma palavra só. Aqui ela vem de `lib/iniciais.ts`, que
 * tem teste.
 *
 * O recuo aparece enquanto a imagem carrega e quando ela falha — sem isso, uma
 * URL de avatar quebrada deixa um buraco cinza sem identificação nenhuma.
 */
const avatarVariants = cva(
  'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
  {
    variants: {
      tamanho: {
        xs: 'size-6 text-3xs',
        sm: 'size-8 text-2xs',
        md: 'size-10 text-sm',
        lg: 'size-14 text-base',
      },
      tom: {
        // design.md §11: círculo roxo com símbolo branco, ou mint com deep-space.
        marca: 'bg-primary/10 text-primary ring-1 ring-primary/20',
        energia: 'bg-success-superficie text-success-texto ring-1 ring-success-borda',
        neutro: 'bg-muted text-muted-foreground ring-1 ring-border',
      },
    },
    defaultVariants: { tamanho: 'sm', tom: 'marca' },
  }
)

export function Avatar({
  nome,
  src,
  tamanho,
  tom,
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants> & {
    nome: string | null | undefined
    src?: string | null
  }) {
  const iniciais = iniciaisDe(nome)

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ tamanho, tom }), 'font-bold', className)}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          // O nome vai no aria-label do Root; repetir aqui faria o leitor de
          // tela anunciar a pessoa duas vezes.
          alt=""
          className="size-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback className="leading-none">{iniciais}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

/**
 * Pilha de avatares sobrepostos, com contagem do excedente.
 *
 * O limite existe porque uma lista de responsáveis sem teto empurra o resto do
 * card para fora em telas estreitas — comportamento que o Kanban já teve.
 */
export function AvatarGrupo({
  pessoas,
  limite = 3,
  tamanho = 'xs',
  className,
}: {
  pessoas: { id: string; nome: string; avatarUrl?: string | null }[]
  limite?: number
  tamanho?: VariantProps<typeof avatarVariants>['tamanho']
  className?: string
}) {
  const visiveis = pessoas.slice(0, limite)
  const excedente = pessoas.length - visiveis.length

  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {visiveis.map((p) => (
        <Avatar
          key={p.id}
          nome={p.nome}
          src={p.avatarUrl}
          tamanho={tamanho}
          aria-label={p.nome}
          title={p.nome}
          className="ring-2 ring-card"
        />
      ))}
      {excedente > 0 && (
        <span
          className={cn(
            avatarVariants({ tamanho, tom: 'neutro' }),
            'font-bold ring-2 ring-card'
          )}
          aria-label={`mais ${excedente}`}
          title={`mais ${excedente}`}
        >
          +{excedente}
        </span>
      )}
    </div>
  )
}

export { avatarVariants }
