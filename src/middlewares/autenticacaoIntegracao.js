// =============================================================
// Autenticação da API v1 (consumo externo) — SOMENTE por CHAVE DE API.
// O header Authorization: Bearer <chave> deve conter exatamente a chave
// gerada em Configurações → Integração (persistida no banco). Não há
// login/JWT nesta API: qualquer valor diferente da chave vigente → 401.
// =============================================================

'use strict';

const crypto = require('crypto');
const { configuracoesModel } = require('../modules/configuracoes/configuracoesModel');

function naoAutorizado(res) {
  return res.status(401).json({
    success: false,
    message: 'Acesso não autorizado. Informe a chave de API válida.'
  });
}

module.exports = async function autenticacaoIntegracao(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return naoAutorizado(res);
  }

  const token = authHeader.split(' ')[1];

  try {
    const apiKey = await configuracoesModel.obterApiKey();
    if (!apiKey || token.length !== apiKey.length) {
      return naoAutorizado(res);
    }
    // Comparação em tempo constante (evita timing attack).
    const igual = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
    if (!igual) {
      return naoAutorizado(res);
    }
  } catch (e) {
    return naoAutorizado(res);
  }

  // Chave válida → identidade de integração (nível 'ti').
  req.usuario = {
    id: null,
    nome: 'Integração (API Key)',
    email: 'integracao@sistema',
    perfil: 'ti',
    acessoConfiguracoes: true,
    acessoControles: true
  };
  req.viaApiKey = true;
  return next();
};
