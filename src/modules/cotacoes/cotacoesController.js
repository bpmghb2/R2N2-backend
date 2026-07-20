'use strict';

const { cotacoesService } = require('./cotacoesService');
const auditService = require('../../services/auditService');

const CotacoesController = {
  async listar(req, res, next) {
    try {
      const { pagina = 1, limite = 100, busca, status, formatType, dataInicio, dataFim } = req.query;
      const r = await cotacoesService.listar({
        pagina: Number(pagina), limite: Number(limite),
        filtros: { busca, status, formatType, dataInicio, dataFim }
      });
      return res.status(200).json({ success: true, data: r.registros, total: r.total });
    } catch (e) { next(e); }
  },

  async buscarPorId(req, res, next) {
    try {
      const c = await cotacoesService.buscarPorId(req.params.id);
      if (!c) return res.status(404).json({ success: false, message: 'Cotação não encontrada' });
      return res.status(200).json({ success: true, data: c });
    } catch (e) { next(e); }
  },

  async criar(req, res, next) {
    try {
      const nova = await cotacoesService.criar(req.body, req.usuario);
      await auditService.registrar({
        acao: 'CRIACAO', entidade: 'cotacao', entidadeId: nova.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { numero: nova.number }
      });
      return res.status(201).json({ success: true, data: nova, message: 'Cotação criada com sucesso' });
    } catch (e) { next(e); }
  },

  async atualizar(req, res, next) {
    try {
      const c = await cotacoesService.atualizar(req.params.id, req.body, req.usuario);
      await auditService.registrar({
        acao: 'ALTERACAO', entidade: 'cotacao', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip
      });
      return res.status(200).json({ success: true, data: c, message: 'Cotação atualizada com sucesso' });
    } catch (e) { next(e); }
  },

  async alterarStatus(req, res, next) {
    try {
      const { status, comentario, justificativa } = req.body;
      const c = await cotacoesService.alterarStatus(req.params.id, status, req.usuario, { comentario, justificativa });
      return res.status(200).json({ success: true, data: c, message: 'Status atualizado' });
    } catch (e) { next(e); }
  },

  async aprovar(req, res, next) {
    try {
      const c = await cotacoesService.aprovar(req.params.id, req.body, req.usuario);
      await auditService.registrar({
        acao: 'APROVACAO', entidade: 'cotacao', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { fornecedor: req.body.approvedSupplierId }
      });
      return res.status(200).json({ success: true, data: c, message: 'Cotação aprovada' });
    } catch (e) { next(e); }
  },

  async clonar(req, res, next) {
    try {
      const c = await cotacoesService.clonar(req.params.id, req.usuario);
      await auditService.registrar({
        acao: 'CRIACAO', entidade: 'cotacao', entidadeId: c.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { clonadaDe: req.params.id, numero: c.number }
      });
      return res.status(201).json({ success: true, data: c, message: 'Cotação clonada' });
    } catch (e) { next(e); }
  },

  async remover(req, res, next) {
    try {
      await cotacoesService.remover(req.params.id, req.usuario);
      await auditService.registrar({
        acao: 'EXCLUSAO', entidade: 'cotacao', entidadeId: req.params.id,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip
      });
      return res.status(200).json({ success: true, message: 'Cotação removida com sucesso' });
    } catch (e) { next(e); }
  }
};

module.exports = CotacoesController;
