import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // 'server-only' lança sempre que importado fora do bundler RSC do
      // Next — inclusive aqui no vitest, mesmo para lib legitimamente
      // server-only sendo testada em Node puro. O próprio pacote já
      // resolve para este arquivo vazio sob a condição `react-server`
      // (ver node_modules/server-only/package.json); apontar o alias para
      // ele reproduz a mesma resolução em vez de inventar um mock novo.
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
      // Mesmo alias '@/*' → raiz do repo que tsconfig.json define para o
      // Next — sem isso, qualquer lib/ importada por um teste que use
      // imports absolutos (o padrão do projeto) falha a resolver.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
