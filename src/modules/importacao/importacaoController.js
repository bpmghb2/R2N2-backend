'use strict';

const { importarBackup } = require('./importacaoService');
const auditService = require('../../services/auditService');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('Importacao');

const ImportacaoController = {
  // POST /api/importacao — recebe o JSON do backup e importa (idempotente).
  async importar(req, res, next) {
    try {
      // Aceita o backup "cru" no corpo OU encapsulado: { backup, manterSenha }.
      const body = req.body || {};
      const encapsulado = body && typeof body === 'object' && body.backup && typeof body.backup === 'object';
      const dados = encapsulado ? body.backup : body;
      if (!dados || typeof dados !== 'object' || (!dados.database && !dados.settings)) {
        return res.status(400).json({
          success: false,
          message: 'JSON inválido: esperado um backup com "database" e/ou "settings".',
        });
      }

      const senhaPadrao = req.query.senhaPadrao || undefined;
      // Importação Completa substitui o banco atual pelo legado por padrão.
      // Use ?modo=mesclar para preservar o que já existe (idempotente).
      const modo = req.query.modo === 'mesclar' ? 'mesclar' : 'substituir';

      // "Manter acesso": aplica a senha informada ao PRÓPRIO usuário autenticado
      // (o e-mail vem do token, nunca do corpo — impede trocar a senha de terceiros).
      const manterSenha = encapsulado && body.manterSenha ? String(body.manterSenha) : null;
      const manterAcesso = manterSenha && req.usuario?.email
        ? { email: req.usuario.email, senha: manterSenha }
        : undefined;

      const relatorio = await importarBackup(dados, { senhaPadrao, modo, manterAcesso });

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
