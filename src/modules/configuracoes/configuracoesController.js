'use strict';

const { configuracoesModel } = require('./configuracoesModel');
const auditService = require('../../services/auditService');

const ConfiguracoesController = {
  async obter(req, res, next) {
    try {
      const config = await configuracoesModel.obter();
      return res.status(200).json({ success: true, data: config });
    } catch (error) { next(error); }
  },

  async atualizar(req, res, next) {
    try {
      const anterior = await configuracoesModel.obter();
      const atualizado = await configuracoesModel.atualizar(req.body, req.usuario.id);
      await auditService.registrarAlteracao({
        entidade: 'configuracoes', entidadeId: '1',
        antes: anterior, depois: atualizado,
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip
      });
      return res.status(200).json({ success: true, data: atualizado, message: 'Configurações atualizadas' });
    } catch (error) { next(error); }
  },

  // GET /configuracoes/api-key — retorna a chave atual (admin). Para exibir/copiar no app.
  async obterApiKey(req, res, next) {
    try {
      const apiKey = await configuracoesModel.obterApiKey();
      return res.status(200).json({ success: true, data: { apiKey } });
    } catch (error) { next(error); }
  },

  // POST /configuracoes/api-key — gera (rotaciona) e retorna a nova chave (admin).
  async gerarApiKey(req, res, next) {
    try {
      const apiKey = await configuracoesModel.gerarApiKey(req.usuario.id);
      await auditService.registrar({
        acao: 'ALTERACAO', entidade: 'configuracoes', entidadeId: '1',
        usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: req.ip,
        metadados: { operacao: 'gerar_api_key' }
      });
      return res.status(200).json({ success: true, data: { apiKey }, message: 'Nova chave de API gerada' });
    } catch (error) { next(error); }
  }
};

module.exports = ConfiguracoesController;
