import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegister } from '@/components/service-worker-register'

export const metadata: Metadata = {
  title: 'Motor de Produtividade',
  description: 'Controle diário de apontamentos',
}

// theme-color por esquema — mesmo par de cores de --background claro/escuro
// em app/globals.css, pra barra de status do PWA instalado bater com o tema.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#090d16' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground selection:bg-primary/30">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
