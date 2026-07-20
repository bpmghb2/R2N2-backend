// =============================================================
// Controller de Usuários — orquestra requisições HTTP.
// =============================================================

'use strict';

const { usuariosService } = require('./usuariosService');
const auditService = require('../../services/auditService');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('UsuariosController');

const UsuariosController = {
  async listar(req, res, next) {
    try {
      const { pagina = 1, limite = 50, busca, perfil } = req.query;
      const resultado = await usuariosService.listar({
        pagina: Number(pagina),
        limite: Math.min(Number(limite), 100),
        filtros: { busca, perfil }
      });
      return res.status(200).json({ success: true, data: resultado.registros, total: resultado.total });
    } catch (error) { next(error); }
  },

  async buscarPorId(req, res, next) {
    try {
      const registro = await usuariosService.buscarPorId(req.params.id);
      if (!registro) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      return res.status(200).json({ success: true, data: registro });
    } catch (error) { next(error); }
  },

  async criar(req, res, next) {
    try {
      const novo = await usuariosService.criar(req.body, req.usuario.id);
      await auditService.registrar({
        acao: 'CRIACAO', entidade: 'usuario', entidadeId: novo.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        dadosDepois: { email: novo.email, perfil: novo.perfil }
      });
      logger.info('Usuário criado', { id: novo.id, por: req.usuario.id });
      return res.status(201).json({ success: true, data: novo, message: 'Usuário criado com sucesso' });
    } catch (error) { next(error); }
  },

  async atualizar(req, res, next) {
    try {
      const atualizado = await usuariosService.atualizar(req.params.id, req.body, req.usuario.id);
      if (!atualizado) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      await auditService.registrar({
        acao: 'ALTERACAO', entidade: 'usuario', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip, dadosDepois: req.body
      });
      return res.status(200).json({ success: true, data: atualizado, message: 'Usuário atualizado com sucesso' });
    } catch (error) { next(error); }
  },

  async redefinirSenha(req, res, next) {
    try {
      await usuariosService.redefinirSenha(req.params.id, req.body.senha, req.body.precisa_trocar_senha);
      await auditService.registrar({
        acao: 'ALTERACAO', entidade: 'usuario', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { operacao: 'redefinir_senha' }
      });
      return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso' });
    } catch (error) { next(error); }
  },

  async remover(req, res, next) {
    try {
      await usuariosService.remover(req.params.id, req.usuario.id);
      await auditService.registrar({
        acao: 'EXCLUSAO', entidade: 'usuario', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        dadosAntes: { ativo: true }, dadosDepois: { ativo: false }
      });
      return res.status(200).json({ success: true, message: 'Usuário removido com sucesso' });
    } catch (error) { next(error); }
  },

  // PATCH /api/v1/usuarios/:id/inativar — inativação para consumo externo (RNF-USR-006).
  async inativar(req, res, next) {
    try {
      const { motivo } = req.body || {};
      const resultado = await usuariosService.inativar(req.params.id, req.usuario.id);
      await auditService.registrar({
        acao: 'EXCLUSAO', entidade: 'usuario', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        dadosAntes: resultado.antes, dadosDepois: resultado.depois,
        metadados: { operacao: 'inativar', motivo: motivo || null }
      });
      logger.info('Usuário inativado', { id: req.params.id, por: req.usuario.id });
      return res.status(200).json({
        success: true,
        data: { id: req.params.id, ativo: false },
        message: 'Usuário inativado com sucesso'
      });
    } catch (error) { next(error); }
  }
};

module.exports = UsuariosController;
