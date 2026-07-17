import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams
  return (
    <div className="flex items-center justify-center min-h-dvh bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Motor de Produtividade</CardTitle>
          <CardDescription>
            Entre na sua conta para registrar seus apontamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="m@exemplo.com" autoComplete="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <Button formAction={login} type="submit" className="w-full">
                Entrar
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Sem conta? Solicite acesso ao seu gestor.
              </p>
            </div>
          </form>
        </CardContent>
        {searchParams?.message && (
          <CardFooter>
            <p className="text-sm text-danger bg-danger/10 p-2 rounded-md w-full text-center">
              {searchParams.message}
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
