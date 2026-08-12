// /kanban e /kanban/arquivados precisam ser mutuamente exclusivas.
//
// Esta é uma propriedade que não falha alto: um quadro arquivado aparecendo na
// lista principal não gera erro, não quebra build e não derruba nenhum outro
// teste — só devolve linhas a mais. Era exatamente o estado anterior, em que
// /kanban listava tudo e marcava o arquivado com opacidade.
//
// A verificação é de código-fonte porque as duas rotas são server components
// que só existem contra um banco. O que dá para travar sem banco é a estrutura
// que garante a exclusividade: as duas passam pelo mesmo carregador, e o
// carregador sempre filtra por `ativo`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ler = (caminho: string) => readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')

const listaAtivos = ler('../page.tsx')
const listaArquivados = ler('./page.tsx')
const carregador = ler('../carregar-quadros.ts')

describe('exclusividade entre a lista de quadros e a de arquivados', () => {
  it('o carregador filtra por ativo', () => {
    expect(carregador).toContain(".eq('ativo', ativo)")
  })

  it('as duas rotas usam o mesmo carregador, em vez de repetir a consulta', () => {
    expect(listaAtivos).toContain('carregarQuadros(true)')
    expect(listaArquivados).toContain('carregarQuadros(false)')
  })

  it('nenhuma das duas consulta quadros por fora do carregador', () => {
    for (const fonte of [listaAtivos, listaArquivados]) {
      expect(fonte).not.toMatch(/\.from\(['"]quadros['"]\)/)
    }
  })

  // O link escondido em /kanban é apresentação. Sem o guard, digitar a URL
  // levaria um colaborador à lista de quadros arquivados da empresa.
  it('a rota de arquivados exige gestor, não só esconde o link', () => {
    expect(listaArquivados).toContain('requireGestor()')
  })
})
