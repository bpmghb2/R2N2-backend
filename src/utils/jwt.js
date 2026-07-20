// =============================================================
// Geração e verificação de tokens JWT (access + refresh).
// =============================================================

'use strict';

const jwt = require('jsonwebtoken');

const CHAVE_SECRETA     = process.env.JWT_SECRET;
const CHAVE_REFRESH     = process.env.JWT_REFRESH_SECRET;
const EXPIRACAO_TOKEN   = process.env.JWT_EXPIRACAO || '8h';
const EXPIRACAO_REFRESH = process.env.JWT_REFRESH_EXPIRACAO || '7d';

/** Gera o par (accessToken, refreshToken) para um usuário. */
function gerarTokens(usuario) {
  const payload = {
    id:     usuario.id,
    nome:   usuario.nome,
    email:  usuario.email,
    perfil: usuario.perfil,
    acessoConfiguracoes: usuario.acesso_configuracoes,
    acessoControles:     usuario.acesso_controles
  };

  const accessToken = jwt.sign(payload, CHAVE_SECRETA, {
    expiresIn: EXPIRACAO_TOKEN,
    issuer: 'r2dn'
  });

  const refreshToken = jwt.sign({ id: usuario.id }, CHAVE_REFRESH, {
    expiresIn: EXPIRACAO_REFRESH
  });

  return { accessToken, refreshToken };
}

/** Verifica e decodifica um access token. Retorna null se inválido/expirado. */
function verificarToken(token) {
  try {
    return jwt.verify(token, CHAVE_SECRETA);
  } catch {
    return null;
  }
}

/** Verifica e decodifica um refresh token. Retorna null se inválido/expirado. */
function verificarRefreshToken(token) {
  try {
    return jwt.verify(token, CHAVE_REFRESH);
  } catch {
    return null;
  }
}

module.exports = { gerarTokens, verificarToken, verificarRefreshToken };
