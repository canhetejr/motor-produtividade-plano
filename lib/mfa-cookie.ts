/**
 * Nome do cookie que marca "sessão criada, segundo fator ainda não conferido".
 *
 * Vive num módulo próprio porque um arquivo `'use server'` só pode exportar
 * função assíncrona — uma constante ali quebra o build. E o valor é lido em
 * três lugares (action que cria, action que verifica, proxy que bloqueia), que
 * precisam concordar.
 *
 * Não guarda segredo: só diz que há um desafio pendente. O que autoriza é a
 * remoção pelo servidor, na verificação.
 */
export const COOKIE_MFA = 'vertice-mfa-pendente'
