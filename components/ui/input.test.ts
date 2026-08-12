// Regressão de um bug que passou despercebido em 13 telas ao mesmo tempo.
//
// A classe base do Input carregava `md:px-2.5`. `cn()` usa tailwind-merge, que
// trata `md:px-2.5` e `px-10` como grupos DIFERENTES — o modificador faz parte
// da chave de conflito, e com razão: `md:px-2.5` e `px-10` de fato podem
// coexistir de propósito. As duas classes sobreviviam ao merge, e a partir de
// 768px a variante `md:` vencia por ordem na folha de estilo.
//
// O efeito era invisível em teste e em mobile: quem passava `pl-10` para
// abrir espaço para um ícone via o padding funcionar até 767px e sumir a
// partir de 768px, com o texto digitado caindo em cima do ícone. Login,
// cadastro, aceite de convite, busca de colaboradores, auditoria, catálogo,
// documentação e changelog tinham todos o mesmo sintoma.
//
// Este teste trava a regra: a base do Input não declara padding horizontal em
// variante de breakpoint, porque quem usa o componente não tem como sobrepor.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cn } from '@/lib/utils'

// Sem os comentários: o próprio comentário que explica a regra cita
// `md:px-2.5` como exemplo do que não fazer, e faria o teste acusar a si mesmo.
const fonte = readFileSync(fileURLToPath(new URL('./input.tsx', import.meta.url)), 'utf8')
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

describe('classe base do Input', () => {
  it('não declara padding horizontal atrás de breakpoint', () => {
    // Qualquer variante responsiva de padding horizontal (px/pl/pr) volta a
    // criar o bug, para qualquer breakpoint.
    expect(fonte).not.toMatch(/\b(sm|md|lg|xl|2xl):p[xlr]-/)
  })

  // Sem variante, base e override convivem e o resultado é o esperado: o
  // Tailwind emite `pl-*` depois de `px-*`, então o lado esquerdo fica com 10.
  it('deixa um pl-* do chamador vencer o padding base sem variante', () => {
    const resultado = cn('px-3 py-1', 'pl-10')
    expect(resultado).toContain('pl-10')
    expect(resultado).toContain('px-3')
  })

  // Com variante o mesmo raciocínio se inverte, e é isso que quebrava: o
  // Tailwind emite as variantes de breakpoint DEPOIS de todas as utilitárias
  // sem variante, então `md:px-2.5` vence `pl-10` a partir de 768px por mais
  // que o merge preserve as duas.
  it('documenta que uma variante md: sobrevive a um pl-* sem variante', () => {
    const resultado = cn('px-3 md:px-2.5', 'pl-10')
    expect(resultado).toContain('md:px-2.5')
    expect(resultado).toContain('pl-10')
  })
})
