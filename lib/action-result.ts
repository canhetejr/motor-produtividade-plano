// Retorno padrão das server actions: sucesso tipado ou erro com mensagem pt-BR.
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }
