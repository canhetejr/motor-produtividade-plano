import type { Metadata, Viewport } from 'next'
import { Sora, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const sora = Sora({ subsets: ['latin'], weight: ['200', '300', '400', '600', '800'], variable: '--font-sans' })
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegister } from '@/components/service-worker-register'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'Vértice · Motor de Produtividade',
  description: 'Controle diário de apontamentos',
  // Sem bloco `icons`: as convenções app/icon.svg e app/apple-icon.png já geram
  // as tags certas. O bloco anterior apontava pra /apple-icon.svg, que o Next 16
  // não serve (a convenção apple-icon só aceita jpg/jpeg/png) — era um 404.
  appleWebApp: {
    capable: true,
    title: 'Vértice',
    // Combina com viewportFit:'cover' — a status bar fica sobre o conteúdo e o
    // app ocupa a tela toda, como um app nativo.
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  // viewportFit 'cover' e o que faz env(safe-area-inset-*) valer algo em iOS —
  // sem ele o pb-[env(safe-area-inset-bottom)] da bottom nav resolve pra 0px.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F6F8' },
    { media: '(prefers-color-scheme: dark)', color: '#09090E' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${jetBrainsMono.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground selection:bg-primary/30" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
