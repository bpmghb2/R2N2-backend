// =============================================================
// Serviço de auditoria — registra ações relevantes na tabela audit_log.
// Falhas de auditoria NUNCA devem quebrar a operação principal.
// =============================================================

'use strict';

const { execute } = require('../config/database');
const { createLogger } = require('../utils/logger');
const logger = createLogger('AuditService');

const auditService = {
  /**
   * Registra um evento de auditoria.
   * @param {Object} p
   * @param {string} p.acao        - LOGIN, LOGIN_FALHA, CRIACAO, ALTERACAO, EXCLUSAO, APROVACAO...
   * @param {string} [p.entidade]  - ex: 'cotacao', 'controle', 'usuario'
   * @param {string} [p.entidadeId]
   * @param {string} [p.usuarioId]
   * @param {string} [p.usuarioNome]
   * @param {string} [p.ip]
   * @param {string} [p.userAgent]
   * @param {Object} [p.dadosAntes]
   * @param {Object} [p.dadosDepois]
   * @param {Object} [p.metadados]
   */
  async registrar(p) {
    try {
      await execute(
        `INSERT INTO audit_log
           (acao, entidade, entidade_id, usuario_id, usuario_nome, ip, user_agent,
            dados_antes, dados_depois, metadados, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())`,
        [
          p.acao,
          p.entidade || null,
          p.entidadeId != null ? String(p.entidadeId) : null,
          p.usuarioId || null,
          p.usuarioNome || null,
          p.ip || null,
          p.userAgent || null,
          p.dadosAntes ? JSON.stringify(p.dadosAntes) : null,
          p.dadosDepois ? JSON.stringify(p.dadosDepois) : null,
          p.metadados ? JSON.stringify(p.metadados) : null
        ]
      );
    } catch (error) {
      // Auditoria nunca deve interromper o fluxo principal.
      logger.error('Falha ao registrar auditoria', { erro: error.message, acao: p.acao });
    }
  },

  /** Atalho para registrar uma alteração (antes/depois). */
  async registrarAlteracao({ entidade, entidadeId, antes, depois, usuarioId, usuarioNome, ip }) {
    return this.registrar({
      acao: 'ALTERACAO', entidade, entidadeId, usuarioId, usuarioNome, ip,
      dadosAntes: antes, dadosDepois: depois
    });
  }
};

module.exports = auditService;
