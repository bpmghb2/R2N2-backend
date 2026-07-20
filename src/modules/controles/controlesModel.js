// =============================================================
// Model de Controles/Demandas.
// =============================================================

'use strict';

const { execute, transacao } = require('../../config/database');

function mapCab(r) {
  return {
    id: r.id,
    number: r.numero,
    title: r.titulo,
    filledBy: r.filled_by || '',
    date: r.data ? r.data.toISOString().slice(0, 10) : '',
    status: r.status,
    fillType: r.fill_type || '',
    frozenAt: r.frozen_at ? r.frozen_at.toISOString() : undefined,
    frozenRemainingDays: r.frozen_remaining_days ?? undefined,
    createdAt: r.origem_created_at ? r.origem_created_at.toISOString() : undefined,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : undefined
  };
}

const controlesModel = {
  async listar({ limite, offset, filtros = {} }) {
    const cond = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (filtros.status) { cond.push(`status = $${idx++}`); params.push(filtros.status); }
    if (filtros.fillType) { cond.push(`fill_type = $${idx++}`); params.push(filtros.fillType); }
    if (filtros.busca) {
      cond.push(`(numero ILIKE $${idx} OR titulo ILIKE $${idx})`);
      params.push(`%${filtros.busca}%`); idx++;
    }
    params.push(limite, offset);
    const [rows] = await execute(
      `SELECT * FROM controles WHERE ${cond.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, params);
    return rows.map(mapCab);
  },

  async contarTotal(filtros = {}) {
    const cond = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (filtros.status) { cond.push(`status = $${idx++}`); params.push(filtros.status); }
    if (filtros.busca) {
      cond.push(`(numero ILIKE $${idx} OR titulo ILIKE $${idx})`);
      params.push(`%${filtros.busca}%`); idx++;
    }
    const [rows] = await execute(`SELECT COUNT(*) total FROM controles WHERE ${cond.join(' AND ')}`, params);
    return parseInt(rows[0].total, 10);
  },

  async buscarCabecalho(id) {
    const [rows] = await execute('SELECT * FROM controles WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  },

  async buscarCompleta(id) {
    const cab = await this.buscarCabecalho(id);
    if (!cab) return null;
    const [hist] = await execute(
      'SELECT * FROM controle_historico WHERE controle_id = $1 ORDER BY evento_em', [id]);
    return {
      ...mapCab(cab),
      history: hist.map((h) => ({
        id: h.id, timestamp: h.evento_em.toISOString(), type: h.tipo,
        user: h.usuario || 'Sistema', message: h.mensagem || ''
      }))
    };
  },

  _cols(d, extra = {}) {
    return {
      numero: d.number,
      titulo: d.title || '',
      filled_by: d.filledBy || null,
      data: d.date || null,
      status: d.status || 'Rascunho',
      fill_type: d.fillType || null,
      frozen_at: d.frozenAt ? new Date(d.frozenAt) : null,
      frozen_remaining_days: d.frozenRemainingDays ?? null,
      origem_created_at: d.createdAt ? new Date(d.createdAt) : null,
      ...extra
    };
  },

  async _inserirHistorico(client, controleId, history = []) {
    for (const h of history) {
      await client.query(
        `INSERT INTO controle_historico (controle_id, evento_em, tipo, usuario, mensagem)
         VALUES ($1,$2,$3,$4,$5)`,
        [controleId, h.timestamp ? new Date(h.timestamp) : new Date(), h.type || 'general',
         h.user || 'Sistema', h.message || '']);
    }
  },

  async criar(d, criadoPor) {
    return transacao(async (client) => {
      const col = this._cols(d, { criado_por: criadoPor });
      const campos = Object.keys(col);
      const vals = Object.values(col);
      const ph = campos.map((_, i) => `$${i + 1}`);
      const { rows } = await client.query(
        `INSERT INTO controles (${campos.join(',')}, created_at, updated_at)
         VALUES (${ph.join(',')}, NOW(), NOW()) RETURNING id`, vals);
      const id = rows[0].id;
      await this._inserirHistorico(client, id, d.history);
      return id;
    });
  },

  async atualizar(id, d, atualizadoPor) {
    return transacao(async (client) => {
      const col = this._cols(d, { atualizado_por: atualizadoPor });
      const campos = Object.keys(col);
      const sets = campos.map((c, i) => `${c} = $${i + 1}`);
      const vals = Object.values(col);
      vals.push(id);
      const { rowCount } = await client.query(
        `UPDATE controles SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${vals.length} AND deleted_at IS NULL`, vals);
      if (rowCount === 0) return null;
      await client.query('DELETE FROM controle_historico WHERE controle_id = $1', [id]);
      await this._inserirHistorico(client, id, d.history);
      return id;
    });
  },

  async adicionarHistorico(controleId, entrada) {
    await execute(
      `INSERT INTO controle_historico (controle_id, evento_em, tipo, usuario, mensagem)
       VALUES ($1, NOW(), $2, $3, $4)`,
      [controleId, entrada.type || 'general', entrada.user || 'Sistema', entrada.message || '']);
  },

  async deletarLogicamente(id, usuarioId) {
    await execute(
      `UPDATE controles SET deleted_at = NOW(), deletado_por = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [usuarioId, id]);
  }
};

module.exports = { controlesModel };
