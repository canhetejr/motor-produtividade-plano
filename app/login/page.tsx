import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VerticeSymbol } from '@/components/vertice-symbol'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage(props: { searchParams: Promise<{ message?: string }> }) {
  const searchParams = await props.searchParams
  return (
    <div
      className="flex items-center justify-center min-h-dvh bg-background p-4"
      style={{ backgroundImage: 'var(--gradient-halo)' }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center gap-3">
          <VerticeSymbol className="h-10 w-10" />
          <div>
            <CardTitle className="text-2xl font-normal">Entrar no Vértice</CardTitle>
            <CardDescription>
              Entre na sua conta para registrar seus apontamentos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input id="email" name="email" type="email" placeholder="voce@empresa.com" autoComplete="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <Button formAction={login} type="submit" className="w-full">
                Continuar
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
