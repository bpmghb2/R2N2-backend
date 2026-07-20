'use strict';

const { controlesService } = require('./controlesService');
const auditService = require('../../services/auditService');

const ControlesController = {
  async listar(req, res, next) {
    try {
      const { pagina = 1, limite = 100, busca, status, fillType } = req.query;
      const r = await controlesService.listar({
        pagina: Number(pagina), limite: Number(limite), filtros: { busca, status, fillType }
      });
      return res.status(200).json({ success: true, data: r.registros, total: r.total });
    } catch (e) { next(e); }
  },

  async buscarPorId(req, res, next) {
    try {
      const c = await controlesService.buscarPorId(req.params.id);
      if (!c) return res.status(404).json({ success: false, message: 'Controle não encontrado' });
      return res.status(200).json({ success: true, data: c });
    } catch (e) { next(e); }
  },

  async criar(req, res, next) {
    try {
      const novo = await controlesService.criar(req.body, req.usuario);
      await auditService.registrar({
        acao: 'CRIACAO', entidade: 'controle', entidadeId: novo.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { numero: novo.number }
      });
      return res.status(201).json({ success: true, data: novo, message: 'Controle criado com sucesso' });
    } catch (e) { next(e); }
  },

  async atualizar(req, res, next) {
    try {
      const c = await controlesService.atualizar(req.params.id, req.body, req.usuario);
      await auditService.registrar({
        acao: 'ALTERACAO', entidade: 'controle', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip
      });
      return res.status(200).json({ success: true, data: c, message: 'Controle atualizado com sucesso' });
    } catch (e) { next(e); }
  },

  async alterarStatus(req, res, next) {
    try {
      const c = await controlesService.alterarStatus(req.params.id, req.body.status, req.usuario);
      return res.status(200).json({ success: true, data: c, message: 'Status atualizado' });
    } catch (e) { next(e); }
  },

  async remover(req, res, next) {
    try {
      await controlesService.remover(req.params.id, req.usuario);
      await auditService.registrar({
        acao: 'EXCLUSAO', entidade: 'controle', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip
      });
      return res.status(200).json({ success: true, message: 'Controle removido com sucesso' });
    } catch (e) { next(e); }
  }
};

module.exports = ControlesController;
