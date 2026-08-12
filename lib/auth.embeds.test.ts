// Regressão do incidente de 12/08/2026: ninguém conseguia entrar no sistema.
//
// A migration 20260812200000 criou `organizacoes_dono_org`, uma segunda
// foreign key entre `colaboradores` e `organizacoes` (a primeira é
// `colaboradores_organizacao_id_fkey`, na direção oposta). Com duas relações
// entre as mesmas tabelas, o PostgREST para de resolver o embed
// `organizacoes(...)` e responde PGRST201 em vez de escolher uma delas.
//
// O modo de falha é o pior possível: `getProfile()` devolve null,
// `requireUser()` redireciona para /login, e o Supabase Auth registra login
// 200 o tempo todo. Da tela, parece "senha errada". Nenhum teste quebrou,
// nenhum build falhou, e `get_advisors` não olha para isto — ambiguidade de
// embed não é problema de RLS nem de índice.
//
// A regra que este arquivo trava: todo embed de `organizacoes` a partir de
// `colaboradores` nomeia a foreign key. Vale para arquivo novo também, por
// isso a varredura é sobre o diretório, não sobre uma lista fixa.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '.next' || entrada === '.git') continue
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, acc)
    else if (/\.(ts|tsx)$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) acc.push(caminho)
  }
  return acc
}

const alvos = ['app', 'lib', 'utils', 'components'].flatMap((d) => arquivosDeCodigo(join(raiz, d)))

describe('embeds de organizacoes a partir de colaboradores', () => {
  it('nomeiam a foreign key, porque existem duas entre as tabelas', () => {
    const ofensores: string[] = []

    for (const caminho of alvos) {
      const fonte = readFileSync(caminho, 'utf8')

      // A varredura é por CONSULTA, não por arquivo: um mesmo arquivo pode ter
      // um `.from('colaboradores')` numa função e um embed legítimo a partir
      // de outra tabela em outra. `assinaturas_manuais` e `convites` têm uma
      // FK só para organizacoes e podem embutir sem nomear — a ambiguidade é
      // exclusiva do par colaboradores ↔ organizacoes, onde as FKs correm nas
      // duas direções.
      const consultas = [...fonte.matchAll(/\.from\(\s*['"]colaboradores['"]\s*\)/g)]
      for (const consulta of consultas) {
        // O .select() encadeado vem logo depois do .from(). A janela cobre a
        // string do select inteira sem alcançar a próxima consulta do arquivo.
        const trecho = fonte.slice(consulta.index, consulta.index + 700)
        const ateProximoFrom = trecho.split(/\.from\(/)[0]
        if (/\borganizacoes\s*\(/.test(ateProximoFrom)) {
          ofensores.push(caminho.replace(raiz, ''))
        }
      }
    }

    expect(
      ofensores,
      'Embed ambíguo de organizacoes a partir de colaboradores: o PostgREST responde PGRST201 e a consulta ' +
        'devolve erro em silêncio. Use organizacoes!colaboradores_organizacao_id_fkey(...). ' +
        'Arquivos: ' +
        ofensores.join(', ')
    ).toEqual([])
  })

  it('getProfile continua lendo a organização da pessoa, não a que ela é dona', () => {
    // As duas FKs apontam para coisas diferentes: `colaboradores_organizacao_id_fkey`
    // é "a empresa desta pessoa"; `organizacoes_dono_org` é "a empresa de que
    // esta pessoa é dona" — que é nula para quase todo mundo. Escolher a
    // segunda por engano faria toda a sessão nascer sem organização.
    const auth = readFileSync(join(raiz, 'lib/auth.ts'), 'utf8')
    expect(auth).toContain('organizacoes!colaboradores_organizacao_id_fkey(')
    expect(auth).not.toContain('organizacoes!organizacoes_dono_org')
  })
})
