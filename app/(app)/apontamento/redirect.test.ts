// O redirect de /apontamento para /minha-semana é a peça que impede a
// unificação de quebrar links que já saíram pelo mundo: o e-mail de lembrete
// diário enviado ontem, o atalho do PWA já instalado, o favorito de quem usa
// o sistema todo dia.
//
// Um 404 aqui não apareceria em teste nenhum — apareceria como "o link do
// e-mail parou de funcionar" na segunda de manhã.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { comSearchParams } from '@/lib/preservar-search-params'

const ler = (caminho: string) => readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')

const rotaApontamento = ler('./page.tsx')
const minhaSemana = ler('../minha-semana/page.tsx')
const email = ler('../../../lib/email.ts')
const manifest = ler('../../manifest.ts')

describe('unificação de Apontamentos em Minha semana', () => {
  it('/apontamento continua existindo e redireciona', () => {
    expect(rotaApontamento).toContain('redirect(')
    expect(rotaApontamento).toContain('/minha-semana')
  })

  // O parâmetro `modo` tem o mesmo nome nas duas rotas justamente para não
  // existir tabela de tradução — o redirect só repassa a query inteira.
  it('preserva a query, com ?modo=lote como caso real', () => {
    expect(comSearchParams('/minha-semana', { modo: 'lote' })).toBe('/minha-semana?modo=lote')
    expect(comSearchParams('/minha-semana', {})).toBe('/minha-semana')
    expect(rotaApontamento).toContain('comSearchParams')
  })

  it('Minha semana lê o mesmo nome de parâmetro', () => {
    expect(minhaSemana).toContain("searchParams.modo === 'lote'")
  })

  it('Minha semana hospeda o painel de lançamento', () => {
    expect(minhaSemana).toContain('PainelApontamento')
  })

  // Correções tinha as quatro actions e as RPCs desde 02/08/2026 e nenhum
  // consumidor de UI. Se a tela sumir de novo, a capacidade volta a ser
  // inalcançável sem que nada quebre.
  it('Minha semana expõe as correções, que antes não tinham tela', () => {
    expect(minhaSemana).toContain('CorrecoesPainel')
  })

  it('o e-mail de lembrete aponta para o hub, não para a rota antiga', () => {
    expect(email).toContain('${APP_URL}/minha-semana')
  })

  it('o PWA abre no hub mas mantém o id, para não órfãos os já instalados', () => {
    expect(manifest).toContain("start_url: '/minha-semana'")
    expect(manifest).toContain("id: '/apontamento'")
  })
})
