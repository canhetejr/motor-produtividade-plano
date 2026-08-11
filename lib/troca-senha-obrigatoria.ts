// Mantém a regra de bloqueio explícita e reutilizável no layout autenticado.
// O estado é persistido no perfil porque o Auth não expõe um marcador confiável
// de "senha temporária" para a sessão atual.
export function deveBloquearAteTrocarSenha(trocaSenhaObrigatoria: boolean): boolean {
  return trocaSenhaObrigatoria
}
