// =============================================================
// Hash e verificação de senhas com bcrypt.
// NUNCA armazenar senha em texto puro.
// =============================================================

'use strict';

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/** Gera o hash de uma senha em texto plano. */
async function hashSenha(senhaTextoPlano) {
  return bcrypt.hash(senhaTextoPlano, SALT_ROUNDS);
}

/** Compara uma senha em texto plano com um hash armazenado (tempo constante). */
async function verificarSenha(senhaTextoPlano, hashArmazenado) {
  if (!hashArmazenado) return false;
  return bcrypt.compare(senhaTextoPlano, hashArmazenado);
}

module.exports = { hashSenha, verificarSenha };
