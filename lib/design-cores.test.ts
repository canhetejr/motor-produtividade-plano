import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Guarda contra cor crua na interface.
 *
 * A base tinha 134 usos de `emerald-*`, `amber-*` e `rose-*` escritos à mão,
 * cada um repetindo a mesma tríade com valores levemente diferentes. Não foi
 * desleixo: o token `--success` é o mint, que como texto sobre papel dá 1,20:1,
 * e as telas improvisaram porque o sistema não oferecia alternativa.
 *
 * A escala semântica resolveu a lacuna. Este teste impede que ela volte a ser
 * contornada — e o número no limite só desce, nunca sobe.
 */

const raiz = resolve(__dirname, '..')

/**
 * Ponto de partida medido: 133 `emerald`, 112 `amber`, 83 `rose`.
 *
 * O número só desce. Cada superfície migrada abaixa o limite, e é isso que
 * transforma a intenção em algo que o repositório cobra.
 */
const LIMITE_ATUAL = 328

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc)
    else if (/\.tsx$/.test(caminho)) acc.push(caminho)
  }
  return acc
}

/**
 * Remove comentário antes de contar.
 *
 * Um comentário que explica por que `emerald-600` foi abandonado não é um uso
 * de `emerald-600` — e sem isto o teste acusa exatamente a documentação da
 * própria migração, que foi o que aconteceu na primeira execução.
 */
function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

const codigo = [join(raiz, 'app'), join(raiz, 'components')]
  .flatMap((d) => arquivos(d))
  .map((f) => ({
    arquivo: f.replace(`${raiz}/`, ''),
    texto: semComentarios(readFileSync(f, 'utf8')),
  }))

describe('cores de estado', () => {
  it('o total de cor crua não cresce', () => {
    const total = codigo.reduce(
      (soma, { texto }) => soma + (texto.match(/\b(emerald|amber|rose)-\d{3}\b/g) ?? []).length,
      0
    )
    expect(
      total,
      `cor crua de estado subiu para ${total} (limite ${LIMITE_ATUAL}). Use EstadoBadge ou os tokens --success-texto / --warning-texto / --danger-texto.`
    ).toBeLessThanOrEqual(LIMITE_ATUAL)
  })

  it('as superfícies já migradas não regridem', () => {
    // Migrar e deixar regredir é pior que nunca ter migrado: dá a impressão de
    // que o sistema está em uso quando não está.
    const migrados = ['app/(app)/dashboard/painel-capacidade.tsx', 'app/(app)/minha-semana/semana-lista.tsx']
    for (const alvo of migrados) {
      const arquivo = codigo.find((c) => c.arquivo === alvo)
      expect(arquivo, `${alvo} não encontrado`).toBeDefined()
      expect(
        arquivo!.texto.match(/\b(emerald|amber|rose)-\d{3}\b/g),
        `${alvo} voltou a usar cor crua`
      ).toBeNull()
    }
  })
})

describe('tokens de estado em globals.css', () => {
  const css = readFileSync(join(raiz, 'app/globals.css'), 'utf8')

  it('cada estado tem os cinco papéis, nos dois temas', () => {
    for (const estado of ['success', 'warning', 'danger']) {
      for (const papel of ['', '-foreground', '-texto', '-superficie', '-borda']) {
        const token = `--${estado}${papel}:`
        // Dois: um no :root (claro) e um no .dark.
        const ocorrencias = css.split(token).length - 1
        expect(ocorrencias, `${token} deveria existir nos dois temas`).toBe(2)
      }
    }
  })

  it('o token de texto está exposto como utilitário do Tailwind', () => {
    // Sem a linha no @theme, `text-success-texto` não existe e a classe é
    // silenciosamente inerte — o mesmo tipo de falha do `.custom-scrollbar`.
    for (const estado of ['success', 'warning', 'danger']) {
      expect(css).toContain(`--color-${estado}-texto: var(--${estado}-texto)`)
    }
  })
})

describe('paleta padrão da Tera', () => {
  const css = readFileSync(join(raiz, 'app/globals.css'), 'utf8')

  it('usa acid, ink e paper da Tera nos tokens principais', () => {
    expect(css).toContain('--tera-acid: #D7F75B')
    expect(css).toContain('--tera-ink: #101010')
    expect(css).toContain('--tera-paper: #F5F3EF')
    expect(css).toContain('--primary: #D7F75B')
    expect(css).toContain('--primary-foreground: #101010')
    expect(css).toContain('--background: #F5F3EF')
  })

  it('mantém a paleta Tera no tema escuro', () => {
    const dark = css.slice(css.indexOf('.dark {'), css.indexOf('@layer base'))
    expect(dark).toContain('--background: #101010')
    expect(dark).toContain('--primary: #D7F75B')
    expect(dark).toContain('--primary-foreground: #101010')
    expect(dark).toContain('--ring: #D7F75B')
    expect(dark).toContain('--sidebar-primary: #D7F75B')
  })
})

describe('primitivos no lugar de codigo a mao', () => {
  it('ninguem reimplementa iniciais de avatar', () => {
    // Estava reescrito em seis telas, e uma das copias quebrava com nome de uma
    // palavra so. A versao unica em lib/iniciais.ts tem teste; estas nao tinham.
    const culpados = codigo
      .filter(({ texto }) => /function getInitials|const getInitials/.test(texto))
      .map((c) => c.arquivo)
    expect(culpados, `use <Avatar> em vez de reimplementar: ${culpados.join(', ')}`).toEqual([])
  })

  it('avatar com foto passa pelo primitivo, que tem recuo', () => {
    // <img> solto nao mostra iniciais quando a URL falha — deixa um buraco
    // cinza sem identificacao nenhuma.
    const culpados = codigo
      .filter(({ texto }) => /<img[^>]*avatarUrl|<img[^>]*fotoExibida/.test(texto))
      .map((c) => c.arquivo)
    expect(culpados, `use <Avatar src={...}>: ${culpados.join(', ')}`).toEqual([])
  })

  it('os seis paineis ja migrados para EmptyState nao regridem', () => {
    // Cada um tinha um <p className="... text-center">Nenhum...</p> escrito a
    // mao, sem icone, sem descricao de proxima acao. Regredir aqui e pior que
    // nunca ter migrado: passa a impressao de que o sistema esta em uso.
    const migrados = [
      'app/(app)/colaboradores/colaboradores-manager.tsx',
      'app/(app)/areas/areas-manager.tsx',
      'app/(app)/catalogo/catalogo-manager.tsx',
      'app/(app)/apontamento/historico/historico-list.tsx',
      'components/layout/notification-bell.tsx',
    ]
    for (const alvo of migrados) {
      const arquivo = codigo.find((c) => c.arquivo === alvo)
      expect(arquivo, `${alvo} não encontrado`).toBeDefined()
      expect(arquivo!.texto, `${alvo} deveria usar <EmptyState>`).toContain('EmptyState')
    }
  })
})
