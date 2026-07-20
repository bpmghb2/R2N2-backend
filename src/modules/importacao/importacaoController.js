'use strict';

const { importarBackup } = require('./importacaoService');
const auditService = require('../../services/auditService');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('Importacao');

const ImportacaoController = {
  // POST /api/importacao — recebe o JSON do backup e importa (idempotente).
  async importar(req, res, next) {
    try {
      const dados = req.body;
      if (!dados || typeof dados !== 'object' || (!dados.database && !dados.settings)) {
        return res.status(400).json({
          success: false,
          message: 'JSON inválido: esperado um backup com "database" e/ou "settings".',
        });
      }

      const senhaPadrao = req.query.senhaPadrao || undefined;
      const relatorio = await importarBackup(dados, { senhaPadrao });

      logger.info('Importação de backup concluída', {
        usuario: req.usuario?.email,
        relatorio,
      });

      await auditService.registrar({
        acao: 'CRIACAO',
        entidade: 'importacao',
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadados: relatorio,
      });

      return res.status(200).json({
        success: true,
        data: relatorio,
        message: 'Importação concluída com sucesso.',
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = ImportacaoController;
