"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `stacked`: abaixo de md a tabela vira uma lista de cards — cada linha um card,
 * cada célula um par rótulo/valor. É CSS puro (`.table-stacked` em globals.css),
 * então a árvore JSX não muda: a alternativa seria manter dois markups por
 * tabela, que divergem no primeiro bugfix.
 *
 * Nas células, use `label` (o texto do cabeçalho, que some no mobile) e `stack`:
 *   'header' → vira o título do card, sem rótulo
 *   'full'   → ocupa a largura inteira (barra de progresso, lista de etiquetas)
 *   'hide'   → some no mobile (dado redundante com o que já aparece no card)
 */
function Table({
  className,
  stacked,
  ...props
}: React.ComponentProps<"table"> & { stacked?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full", stacked ? "md:overflow-x-auto" : "overflow-x-auto")}
    >
      <table
        data-slot="table"
        // `display:block` (que o modo stacked aplica) apaga os papéis implícitos
        // de tabela para leitores de tela. Os role explícitos sobrevivem à
        // troca de display e não custam nada no desktop.
        role="table"
        className={cn("w-full caption-bottom text-sm", stacked && "table-stacked", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      role="row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      role="columnheader"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  label,
  stack,
  ...props
}: React.ComponentProps<"td"> & { label?: string; stack?: "header" | "full" | "hide" }) {
  return (
    <td
      data-slot="table-cell"
      role="cell"
      data-label={label}
      data-stack={stack}
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
