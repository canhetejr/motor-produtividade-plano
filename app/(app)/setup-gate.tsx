'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Leva quem ainda não passou pelo setup inicial para /setup.
 *
 * O redirect é do cliente, e não do proxy, porque `setup_concluido_em` mora em
 * `colaboradores`: fazer isso no proxy custaria uma query de perfil em toda
 * requisição do app — exatamente o que utils/supabase/middleware.ts evita de
 * propósito para o gate de papel. Aqui o dado já veio junto com o layout.
 *
 * Não é uma trava de segurança: nada em /setup autoriza nada. É onboarding, e
 * a própria tela oferece pular.
 */
export function SetupGate({ pendente }: { pendente: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pendente && pathname !== '/setup') router.replace('/setup')
  }, [pendente, pathname, router])

  return null
}
