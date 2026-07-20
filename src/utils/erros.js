// =============================================================
// Fábrica de erros tipados.
// Diferencia erros de NEGÓCIO (esperados, 422) de erros técnicos (500).
// =============================================================

'use strict';

/** Cria um erro de regra de negócio (retornado como 422 ao cliente). */
function errNegocio(mensagem) {
  return Object.assign(new Error(mensagem), { tipo: 'NEGOCIO' });
}

/** Cria um erro de "não encontrado" (retornado como 404). */
function errNaoEncontrado(mensagem = 'Registro não encontrado') {
  return Object.assign(new Error(mensagem), { tipo: 'NAO_ENCONTRADO' });
}

/** Cria um erro de autorização/regra de proteção (retornado como 403). */
function errAutorizacao(mensagem = 'Operação não permitida') {
  return Object.assign(new Error(mensagem), { tipo: 'AUTORIZACAO' });
}

module.exports = { errNegocio, errNaoEncontrado, errAutorizacao };
