// =============================================================
// Middleware de autorização para a API externa de usuários (/api/v1).
// Permite apenas perfis administrador/ti (RNF-USR-001) e audita o
// acesso negado 403 (RNF-USR-004). Usar SEMPRE após `autenticacao`.
// =============================================================

'use strict';

const auditService = require('../services/auditService');
const { createLogger } = require('../utils/logger');
const logger = createLogger('SomenteAdmin');

const PERFIS_ADMIN = ['administrador', 'ti'];

module.exports = function somenteAdmin(permissaoExigida) {
  return function (req, res, next) {
    const perfil = req.usuario?.perfil;
    if (PERFIS_ADMIN.includes(perfil)) return next();

    logger.warn('Acesso negado (403) na API de usuários', {
      usuarioId: req.usuario?.id,
      perfil,
      endpoint: req.originalUrl,
      permissaoExigida
    });
    // RNF-USR-004: auditar tentativas de acesso negado.
    auditService.registrar({
      acao: 'ACESSO_NEGADO', entidade: 'usuario',
      usuarioId: req.usuario?.id, usuarioNome: req.usuario?.nome, ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadados: { endpoint: req.originalUrl, permissao_exigida: permissaoExigida, status: 403 }
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      message: 'Você não tem permissão para acessar este recurso.'
    });
  };
};
