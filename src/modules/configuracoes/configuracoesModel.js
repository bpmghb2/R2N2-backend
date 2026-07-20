// =============================================================
// Model de Configurações (linha única id=1).
// =============================================================

'use strict';

const crypto = require('crypto');
const { execute } = require('../../config/database');

// Remove a chave de API do objeto retornado ao cliente (nunca expor no GET geral).
function semSegredos(row) {
  if (!row) return row;
  const { api_bearer_key, ...publico } = row;
  return publico;
}

// Campos editáveis via API (whitelist — evita update de colunas de auditoria/contadores).
const CAMPOS_EDITAVEIS = [
  'client_identification', 'corporate_identity', 'control_numbering_prefix',
  'default_project_name', 'hide_total_costs_chart', 'sort_by_cheapest',
  'prazo_compras', 'prazo_contratos', 'alcada_gerenciadora_max_valor',
  'dashboard_export_filename', 'purchase_order_filename', 'supplier_info_text_1',
  'supplier_info_text_2', 'cno', 'control_access_emails', 'pending_access_emails',
  'warning_text_template', 'email_template', 'logo_url', 'logo_height'
];

const configuracoesModel = {
  async obter() {
    const [rows] = await execute('SELECT * FROM configuracoes WHERE id = 1');
    return semSegredos(rows[0]) || null;
  },

  /** Retorna a chave de API bruta (uso interno: middleware v1 e endpoint admin). */
  async obterApiKey() {
    const [rows] = await execute('SELECT api_bearer_key FROM configuracoes WHERE id = 1');
    return rows[0]?.api_bearer_key || null;
  },

  /** Gera, persiste e retorna uma nova chave de API (rotação). */
  async gerarApiKey(atualizadoPor) {
    const chave = 'r2dn_' + crypto.randomBytes(32).toString('hex');
    await execute(
      `UPDATE configuracoes SET api_bearer_key = $1, atualizado_por = $2, updated_at = NOW() WHERE id = 1`,
      [chave, atualizadoPor || null]
    );
    return chave;
  },

  async atualizar(dados, atualizadoPor) {
    const sets = [];
    const params = [];
    let idx = 1;

    for (const campo of CAMPOS_EDITAVEIS) {
      if (dados[campo] !== undefined) {
        sets.push(`${campo} = $${idx++}`);
        params.push(dados[campo]);
      }
    }

    if (sets.length === 0) return this.obter();

    sets.push(`atualizado_por = $${idx++}`);
    params.push(atualizadoPor || null);
    sets.push('updated_at = NOW()');

    const [rows] = await execute(
      `UPDATE configuracoes SET ${sets.join(', ')} WHERE id = 1 RETURNING *`,
      params
    );
    return semSegredos(rows[0]);
  },

  /** Incrementa e retorna o próximo número de cotação (transacional). */
  async proximoNumeroCotacao(client) {
    const q = client ? client.query.bind(client) : null;
    const sql = `UPDATE configuracoes SET last_quote_number = last_quote_number + 1
                 WHERE id = 1 RETURNING last_quote_number, control_numbering_prefix`;
    if (q) {
      const { rows } = await q(sql);
      return rows[0];
    }
    const [rows] = await execute(sql);
    return rows[0];
  },

  /** Incrementa e retorna o próximo número de controle (transacional). */
  async proximoNumeroControle(client) {
    const q = client ? client.query.bind(client) : null;
    const sql = `UPDATE configuracoes SET last_control_number = last_control_number + 1
                 WHERE id = 1 RETURNING last_control_number`;
    if (q) {
      const { rows } = await q(sql);
      return rows[0];
    }
    const [rows] = await execute(sql);
    return rows[0];
  }
};

module.exports = { configuracoesModel, CAMPOS_EDITAVEIS };
