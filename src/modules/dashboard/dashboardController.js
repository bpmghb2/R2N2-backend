'use strict';

const { execute } = require('../../config/database');
const { getDiasRestantes } = require('../../utils/prazo');

const DashboardController = {
  // Contagem de itens vencidos ou vencendo hoje (para o badge do app / notificações).
  async notificacoes(req, res, next) {
    try {
      const [cfgRows] = await execute('SELECT prazo_compras, prazo_contratos FROM configuracoes WHERE id = 1');
      const cfg = cfgRows[0] || {};
      const prazoCompras = cfg.prazo_compras ?? 3;
      const prazoContratos = cfg.prazo_contratos ?? 5;

      const [cots] = await execute(
        `SELECT status, prazo_dias, format_type, origem_created_at, data, frozen_remaining_days
           FROM cotacoes
          WHERE deleted_at IS NULL AND status IN ('Pendente','Aguardando Fornecedor')`);
      const [ctrls] = await execute(
        `SELECT status, data, frozen_remaining_days
           FROM controles
          WHERE deleted_at IS NULL AND status IN ('Pendente','Pendência Fornecedor','Em Andamento')`);

      let count = 0;
      for (const q of cots) {
        let rem;
        if (q.status === 'Aguardando Fornecedor' && q.frozen_remaining_days != null) {
          rem = Number(q.frozen_remaining_days);
        } else {
          const limite =
            q.prazo_dias != null
              ? Number(q.prazo_dias)
              : q.format_type === 'Contratos' || q.format_type === 'Serviço'
              ? prazoContratos
              : prazoCompras;
          rem = getDiasRestantes(q.origem_created_at || q.data, limite);
        }
        if (rem <= 0) count++;
      }
      for (const c of ctrls) {
        let rem;
        if (c.status === 'Pendência Fornecedor' && c.frozen_remaining_days != null) {
          rem = Number(c.frozen_remaining_days);
        } else {
          rem = getDiasRestantes(c.data, prazoContratos);
        }
        if (rem <= 0) count++;
      }

      return res.status(200).json({ success: true, data: { count } });
    } catch (e) {
      next(e);
    }
  },

  async resumo(req, res, next) {
    try {
      const [cotStatus] = await execute(
        `SELECT status, COUNT(*) total FROM cotacoes WHERE deleted_at IS NULL GROUP BY status`);
      const [ctrlStatus] = await execute(
        `SELECT status, COUNT(*) total FROM controles WHERE deleted_at IS NULL GROUP BY status`);
      const [totais] = await execute(
        `SELECT
           (SELECT COUNT(*) FROM cotacoes WHERE deleted_at IS NULL) AS total_cotacoes,
           (SELECT COUNT(*) FROM controles WHERE deleted_at IS NULL) AS total_controles`);

      return res.status(200).json({
        success: true,
        data: {
          totais: totais[0],
          cotacoesPorStatus: cotStatus.reduce((a, r) => (a[r.status] = Number(r.total), a), {}),
          controlesPorStatus: ctrlStatus.reduce((a, r) => (a[r.status] = Number(r.total), a), {})
        }
      });
    } catch (e) { next(e); }
  }
};

module.exports = DashboardController;
