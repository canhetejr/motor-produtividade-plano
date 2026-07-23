import type { MetadataRoute } from 'next'

// Convenção Next 16: app/manifest.ts gera manifest.webmanifest automaticamente
// (ver node_modules/next/dist/docs/.../file-conventions/01-metadata/manifest.md).
// /apontamento é a tela mais usada no dia a dia (mobile-first) — é ela que abre
// ao instalar na tela inicial, não a raiz (que só redireciona).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Motor de Produtividade',
    short_name: 'Motor',
    description: 'Controle diário de apontamentos',
    start_url: '/apontamento',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#006652',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
