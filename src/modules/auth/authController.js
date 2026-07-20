// =============================================================
// Controller de Autenticação.
// Retorna os tokens no corpo — o proxy BFF (Next.js) os grava
// em cookies httpOnly. O navegador nunca manipula os tokens.
// =============================================================

'use strict';

const authService = require('./authService');
const auditService = require('../../services/auditService');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('AuthController');

const AuthController = {
  async login(req, res, next) {
    try {
      const { email, senha } = req.body;
      const resultado = await authService.login(email, senha);

      await auditService.registrar({
        acao: 'LOGIN', entidade: 'usuario', entidadeId: resultado.usuario.id,
        usuarioId: resultado.usuario.id, usuarioNome: resultado.usuario.nome,
        ip: req.ip, userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        data: resultado,
        message: 'Autenticado com sucesso'
      });
    } catch (error) {
      if (error.tipo === 'CREDENCIAIS') {
        await auditService.registrar({
          acao: 'LOGIN_FALHA', entidade: 'usuario', ip: req.ip,
          metadados: { email: req.body?.email }
        });
        return res.status(401).json({ success: false, message: error.message });
      }
      next(error);
    }
  },

  async refresh(req, res, next) {
    try {
      const refreshToken = req.body?.refreshToken || req.headers['x-refresh-token'];
      if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token ausente' });
      const resultado = await authService.renovar(refreshToken);
      return res.status(200).json({ success: true, data: resultado });
    } catch (error) {
      if (error.tipo === 'CREDENCIAIS') {
        return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
      }
      next(error);
    }
  },

  async me(req, res, next) {
    try {
      const usuario = await authService.me(req.usuario.id);
      if (!usuario) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      return res.status(200).json({ success: true, data: usuario });
    } catch (error) { next(error); }
  },

  async trocarSenha(req, res, next) {
    try {
      const { senhaAtual, novaSenha } = req.body || {};
      await authService.trocarSenha(req.usuario, senhaAtual, novaSenha);
      await auditService.registrar({
        acao: 'ALTERACAO', entidade: 'usuario', entidadeId: req.usuario.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { evento: 'troca_de_senha' }
      });
      return res.status(200).json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (error) {
      if (error.tipo === 'NEGOCIO') {
        return res.status(422).json({ success: false, message: error.message });
      }
      next(error);
    }
  },

  async logout(req, res) {
    // Stateless: o proxy BFF limpa os cookies. Registramos a auditoria.
    if (req.usuario) {
      await auditService.registrar({
        acao: 'LOGOUT', entidade: 'usuario', entidadeId: req.usuario.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip
      });
    }
    return res.status(200).json({ success: true, message: 'Sessão encerrada' });
  }
};

module.exports = AuthController;
