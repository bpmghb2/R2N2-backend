// =============================================================
// Model de Cotações — persistência transacional do agregado.
// Mapeia entre o schema relacional (snake_case) e o modelo de
// domínio usado pelo frontend (camelCase, herdado de types.ts).
// =============================================================

'use strict';

const { execute, transacao } = require('../../config/database');

// ---------- Mapeamento DB -> domínio ----------
function mapCabecalho(r) {
  return {
    id: r.id,
    number: r.numero,
    title: r.titulo,
    date: r.data ? r.data.toISOString().slice(0, 10) : '',
    projectName: r.projeto_nome,
    clientName: r.cliente_nome,
    engineerName: r.engenheiro_nome,
    status: r.status,
    formatType: r.format_type,
    prazoDias: r.prazo_dias,
    locked: r.locked,
    savedToCloud: r.saved_to_cloud,
    approvalDate: r.aprovacao_data ? r.aprovacao_data.toISOString().slice(0, 10) : undefined,
    managerChoiceSupplierId: r.manager_choice_supplier_ref || undefined,
    managerChoiceJustification: r.manager_choice_justificativa || undefined,
    approvedSupplierId: r.approved_supplier_ref || undefined,
    approvedSupplierJustification: r.approved_supplier_justificativa || undefined,
    frozenAt: r.frozen_at ? r.frozen_at.toISOString() : undefined,
    frozenRemainingDays: r.frozen_remaining_days ?? undefined,
    emailSentAt: r.email_sent_at ? r.email_sent_at.toISOString() : undefined,
    filledBy: r.filled_by || '',
    createdAt: r.origem_created_at ? r.origem_created_at.toISOString() : undefined,
    updatedAt: r.updated_at ? r.updated_at.toISOString() : undefined
  };
}

const cotacoesModel = {
  async listar({ limite, offset, filtros = {} }) {
    const cond = ['c.deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (filtros.status) { cond.push(`c.status = $${idx++}`); params.push(filtros.status); }
    if (filtros.formatType) { cond.push(`c.format_type = $${idx++}`); params.push(filtros.formatType); }
    if (filtros.busca) {
      cond.push(`(c.numero ILIKE $${idx} OR c.titulo ILIKE $${idx} OR c.projeto_nome ILIKE $${idx})`);
      params.push(`%${filtros.busca}%`); idx++;
    }
    if (filtros.dataInicio) { cond.push(`c.data >= $${idx++}`); params.push(filtros.dataInicio); }
    if (filtros.dataFim) { cond.push(`c.data <= $${idx++}`); params.push(filtros.dataFim); }

    params.push(limite, offset);
    const [rows] = await execute(
      `SELECT c.* FROM cotacoes c
       WHERE ${cond.join(' AND ')}
       ORDER BY c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    return rows.map(mapCabecalho);
  },

  async contarTotal(filtros = {}) {
    const cond = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (filtros.status) { cond.push(`status = $${idx++}`); params.push(filtros.status); }
    if (filtros.formatType) { cond.push(`format_type = $${idx++}`); params.push(filtros.formatType); }
    if (filtros.busca) {
      cond.push(`(numero ILIKE $${idx} OR titulo ILIKE $${idx} OR projeto_nome ILIKE $${idx})`);
      params.push(`%${filtros.busca}%`); idx++;
    }
    const [rows] = await execute(`SELECT COUNT(*) total FROM cotacoes WHERE ${cond.join(' AND ')}`, params);
    return parseInt(rows[0].total, 10);
  },

  async buscarCabecalho(id) {
    const [rows] = await execute('SELECT * FROM cotacoes WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  },

  /** Monta o agregado completo (cotação + coleções aninhadas). */
  async buscarCompleta(id) {
    const cab = await this.buscarCabecalho(id);
    if (!cab) return null;

    const [fornecedores] = await execute(
      'SELECT * FROM cotacao_fornecedores WHERE cotacao_id = $1 ORDER BY ordem, created_at', [id]);
    const [itens] = await execute(
      'SELECT * FROM cotacao_itens WHERE cotacao_id = $1 ORDER BY ordem, numero', [id]);
    const idsItens = itens.map((i) => i.id);
    let precos = [];
    if (idsItens.length) {
      const [p] = await execute(
        'SELECT * FROM cotacao_item_precos WHERE item_id = ANY($1::uuid[])', [idsItens]);
      precos = p;
    }
    const [inclusoes] = await execute(
      'SELECT * FROM cotacao_inclusoes WHERE cotacao_id = $1 ORDER BY ordem, numero', [id]);
    const [exclusoes] = await execute(
      'SELECT * FROM cotacao_exclusoes WHERE cotacao_id = $1 ORDER BY ordem, numero', [id]);
    const [historico] = await execute(
      'SELECT * FROM cotacao_historico WHERE cotacao_id = $1 ORDER BY evento_em', [id]);

    // internal fornecedor id -> external_id (para reconstruir o mapa "prices")
    const fornecedorExternalById = {};
    fornecedores.forEach((f) => { fornecedorExternalById[f.id] = f.external_id; });

    const precosPorItem = {};
    precos.forEach((pr) => {
      const ext = fornecedorExternalById[pr.fornecedor_id];
      if (!ext) return;
      (precosPorItem[pr.item_id] ??= {})[ext] =
        pr.preco_unitario != null ? Number(pr.preco_unitario) : undefined;
    });

    return {
      ...mapCabecalho(cab),
      suppliers: fornecedores.map((f) => ({
        id: f.external_id, name: f.nome, contact: f.contato || '',
        paymentTerm: f.prazo_pagamento || '', freight: Number(f.frete), taxes: Number(f.impostos)
      })),
      items: itens.map((i) => ({
        id: i.external_id, number: i.numero, description: i.descricao,
        unit: i.unidade, quantity: Number(i.quantidade), prices: precosPorItem[i.id] || {}
      })),
      inclusions: inclusoes.map((x) => ({ id: x.id, number: x.numero, service: x.servico, description: x.descricao })),
      exclusions: exclusoes.map((x) => ({ id: x.id, number: x.numero, service: x.servico, description: x.descricao })),
      history: historico.map((h) => ({
        id: h.id, timestamp: h.evento_em.toISOString(), type: h.tipo,
        fromStatus: h.from_status || undefined, toStatus: h.to_status || undefined,
        user: h.usuario || 'Sistema', message: h.mensagem || '', justification: h.justificativa || undefined
      }))
    };
  },

  /** Insere as coleções aninhadas de uma cotação (usa client em transação). */
  async _inserirFilhos(client, cotacaoId, dominio) {
    const externalToInternalForn = {};

    let ordem = 0;
    for (const s of dominio.suppliers || []) {
      const { rows } = await client.query(
        `INSERT INTO cotacao_fornecedores (cotacao_id, external_id, nome, contato, prazo_pagamento, frete, impostos, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [cotacaoId, s.id, s.name || '', s.contact || null, s.paymentTerm || null,
         Number(s.freight) || 0, Number(s.taxes) || 0, ordem++]
      );
      externalToInternalForn[s.id] = rows[0].id;
    }

    ordem = 0;
    for (const it of dominio.items || []) {
      const { rows } = await client.query(
        `INSERT INTO cotacao_itens (cotacao_id, external_id, numero, descricao, unidade, quantidade, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [cotacaoId, it.id, it.number || 0, it.description || '', it.unit || 'Un',
         Number(it.quantity) || 0, ordem++]
      );
      const itemId = rows[0].id;
      const precos = it.prices || {};
      for (const [extForn, valor] of Object.entries(precos)) {
        const fornId = externalToInternalForn[extForn];
        if (!fornId) continue;
        await client.query(
          `INSERT INTO cotacao_item_precos (item_id, fornecedor_id, preco_unitario) VALUES ($1,$2,$3)`,
          [itemId, fornId, valor === undefined || valor === null || valor === '' ? null : Number(valor)]
        );
      }
    }

    ordem = 0;
    for (const inc of dominio.inclusions || []) {
      await client.query(
        `INSERT INTO cotacao_inclusoes (cotacao_id, numero, servico, descricao, ordem) VALUES ($1,$2,$3,$4,$5)`,
        [cotacaoId, inc.number || 0, inc.service || '', inc.description || '', ordem++]);
    }
    ordem = 0;
    for (const exc of dominio.exclusions || []) {
      await client.query(
        `INSERT INTO cotacao_exclusoes (cotacao_id, numero, servico, descricao, ordem) VALUES ($1,$2,$3,$4,$5)`,
        [cotacaoId, exc.number || 0, exc.service || '', exc.description || '', ordem++]);
    }
    for (const h of dominio.history || []) {
      await client.query(
        `INSERT INTO cotacao_historico (cotacao_id, evento_em, tipo, from_status, to_status, usuario, mensagem, justificativa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [cotacaoId, h.timestamp ? new Date(h.timestamp) : new Date(), h.type || 'general',
         h.fromStatus || null, h.toStatus || null, h.user || 'Sistema', h.message || '', h.justification || null]);
    }
  },

  _colunasCabecalho(d, extra = {}) {
    return {
      numero: d.number,
      titulo: d.title || '',
      data: d.date || null,
      projeto_nome: d.projectName || '',
      cliente_nome: d.clientName || '',
      engenheiro_nome: d.engineerName || '',
      status: d.status || 'Rascunho',
      format_type: d.formatType || 'Compras',
      prazo_dias: d.prazoDias ?? null,
      locked: d.locked ?? false,
      saved_to_cloud: d.savedToCloud ?? true,
      aprovacao_data: d.approvalDate || null,
      manager_choice_supplier_ref: d.managerChoiceSupplierId || null,
      manager_choice_justificativa: d.managerChoiceJustification || null,
      approved_supplier_ref: d.approvedSupplierId || null,
      approved_supplier_justificativa: d.approvedSupplierJustification || null,
      frozen_at: d.frozenAt ? new Date(d.frozenAt) : null,
      frozen_remaining_days: d.frozenRemainingDays ?? null,
      email_sent_at: d.emailSentAt ? new Date(d.emailSentAt) : null,
      filled_by: d.filledBy || null,
      origem_created_at: d.createdAt ? new Date(d.createdAt) : null,
      ...extra
    };
  },

  async criar(dominio, criadoPor) {
    return transacao(async (client) => {
      const col = this._colunasCabecalho(dominio, { criado_por: criadoPor });
      const campos = Object.keys(col);
      const valores = Object.values(col);
      const placeholders = campos.map((_, i) => `$${i + 1}`);
      const { rows } = await client.query(
        `INSERT INTO cotacoes (${campos.join(',')}, created_at, updated_at)
         VALUES (${placeholders.join(',')}, NOW(), NOW()) RETURNING id`,
        valores
      );
      const cotacaoId = rows[0].id;
      await this._inserirFilhos(client, cotacaoId, dominio);
      return cotacaoId;
    });
  },

  async atualizar(id, dominio, atualizadoPor) {
    return transacao(async (client) => {
      const col = this._colunasCabecalho(dominio, { atualizado_por: atualizadoPor });
      const campos = Object.keys(col);
      const sets = campos.map((c, i) => `${c} = $${i + 1}`);
      const valores = Object.values(col);
      valores.push(id);
      const { rowCount } = await client.query(
        `UPDATE cotacoes SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${valores.length} AND deleted_at IS NULL`,
        valores
      );
      if (rowCount === 0) return null;

      // Substitui coleções (padrão "overwrite" herdado do Firebase; children via ON DELETE CASCADE)
      await client.query('DELETE FROM cotacao_fornecedores WHERE cotacao_id = $1', [id]);
      await client.query('DELETE FROM cotacao_itens WHERE cotacao_id = $1', [id]);
      await client.query('DELETE FROM cotacao_inclusoes WHERE cotacao_id = $1', [id]);
      await client.query('DELETE FROM cotacao_exclusoes WHERE cotacao_id = $1', [id]);
      await client.query('DELETE FROM cotacao_historico WHERE cotacao_id = $1', [id]);
      await this._inserirFilhos(client, id, dominio);
      return id;
    });
  },

  async adicionarHistorico(cotacaoId, entrada) {
    await execute(
      `INSERT INTO cotacao_historico (cotacao_id, evento_em, tipo, from_status, to_status, usuario, mensagem, justificativa)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
      [cotacaoId, entrada.type || 'general', entrada.fromStatus || null, entrada.toStatus || null,
       entrada.user || 'Sistema', entrada.message || '', entrada.justification || null]);
  },

  async deletarLogicamente(id, usuarioId) {
    await execute(
      `UPDATE cotacoes SET deleted_at = NOW(), deletado_por = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [usuarioId, id]);
  }
};

module.exports = { cotacoesModel, mapCabecalho };
