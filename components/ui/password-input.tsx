'use client'

import * as React from 'react'
import { Eye, EyeOff, Dices } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function gerarSenha(tamanho = 10): string {
  const bytes = new Uint32Array(tamanho)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('')
}

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'defaultValue'> & {
  defaultValue?: string
}

// Input de senha com mostrar/ocultar e um botão "gerar senha aleatória" — usado
// no cadastro de colaborador e na redefinição de senha, onde o gestor mesmo
// define uma senha temporária (sem cadastro público / e-mail de recuperação).
// Controlado internamente (em vez de mexer no DOM via ref) pra "gerar senha"
// só precisar de um setState — o `name` do form continua funcionando normal
// na leitura via FormData no submit.
export function PasswordInput({ defaultValue = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue)

  return (
    <div className="flex min-w-0 gap-2">
      <div className="relative min-w-0 flex-1">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`pr-11 ${props.className ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-0.5 top-1/2 flex size-9 -translate-y-1/2 touch-manipulation items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          setValue(gerarSenha())
          setVisible(true)
        }}
        title="Gerar senha aleatória"
        aria-label="Gerar senha aleatória"
      >
        <Dices className="h-4 w-4" />
      </Button>
    </div>
  )
}
