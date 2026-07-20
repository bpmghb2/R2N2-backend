// =============================================================
// Middleware de autenticação — valida o JWT do header Authorization.
// Em sucesso, popula req.usuario. Também garante que o usuário ainda
// está ATIVO (RNF-USR-006: sessão invalida ao inativar) e audita 401.
// =============================================================

'use strict';

const { verificarToken } = require('../utils/jwt');
const usuariosModel = require('../modules/usuarios/usuariosModel');
const auditService = require('../services/auditService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Autenticacao');

function auditarFalha(req, motivo) {
  auditService.registrar({
    acao: 'LOGIN_FALHA', entidade: 'usuario', ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadados: { endpoint: req.originalUrl, motivo, status: 401 }
  }).catch(() => {});
}

module.exports = async function autenticacao(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Faça login para continuar.'
      });
    }

    const token = authHeader.split(' ')[1];
    const dados = verificarToken(token);

    if (!dados) {
      auditarFalha(req, 'token_invalido_ou_expirado');
      return res.status(401).json({
        success: false,
        message: 'Sessão expirada. Faça login novamente.'
      });
    }

    // RNF-USR-006: usuário inativado/removido não autentica na próxima requisição.
    const ativo = await usuariosModel.estaAtivo(dados.id);
    if (!ativo) {
      auditarFalha(req, 'usuario_inativo');
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo. Contate o administrador.'
      });
    }

    req.usuario = {
      id:                   dados.id,
      nome:                 dados.nome,
      email:                dados.email,
      perfil:               dados.perfil,
      acessoConfiguracoes:  dados.acessoConfiguracoes,
      acessoControles:      dados.acessoControles
    };

    next();
  } catch (error) {
    logger.warn('Falha na autenticação', { ip: req.ip, rota: req.path, erro: error.message });
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};
