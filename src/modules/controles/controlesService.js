'use strict';

const { controlesModel } = require('./controlesModel');
const { configuracoesModel } = require('../configuracoes/configuracoesModel');
const { errNegocio, errNaoEncontrado } = require('../../utils/erros');
const { getDiasRestantes, getInicioAjustadoPosDescongelamento } = require('../../utils/prazo');

const STATUS_CONGELA = 'Pendência Fornecedor';

const controlesService = {
  async listar({ pagina, limite, filtros }) {
    const p = Math.max(1, pagina);
    const l = Math.min(200, Math.max(1, limite));
    const offset = (p - 1) * l;
    const [registros, total] = await Promise.all([
      controlesModel.listar({ limite: l, offset, filtros }),
      controlesModel.contarTotal(filtros)
    ]);
    return { registros, total };
  },

  buscarPorId(id) { return controlesModel.buscarCompleta(id); },

  async gerarNumero() {
    const { last_control_number } = await configuracoesModel.proximoNumeroControle();
    return String(last_control_number).padStart(4, '0');
  },

  async criar(d, usuario) {
    const number = d.number && d.number.trim() ? d.number.trim() : await this.gerarNumero();
    const novo = {
      ...d, number, status: d.status || 'Rascunho',
      history: d.history && d.history.length ? d.history : [{
        type: 'creation', user: usuario?.email || 'Sistema',
        message: 'Controle de Demanda criado.', timestamp: new Date().toISOString()
      }]
    };
    const id = await controlesModel.criar(novo, usuario?.id);
    return controlesModel.buscarCompleta(id);
  },

  async atualizar(id, d, usuario) {
    const atual = await controlesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Controle não encontrado');
    const ok = await controlesModel.atualizar(id, { ...d, number: d.number || atual.numero }, usuario?.id);
    if (!ok) throw errNaoEncontrado('Controle não encontrado');
    return controlesModel.buscarCompleta(id);
  },

  async alterarStatus(id, novoStatus, usuario) {
    const atual = await controlesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Controle não encontrado');
    const antigo = atual.status;
    if (antigo === novoStatus) return controlesModel.buscarCompleta(id);

    const cfg = await configuracoesModel.obter();
    const limite = cfg?.prazo_contratos ?? 5;
    const patch = {};

    if (novoStatus === 'Pendente' && (antigo === 'Rascunho' || !atual.origem_created_at)) {
      patch.origem_created_at = new Date();
      patch.frozen_at = null;
      patch.frozen_remaining_days = null;
    } else if (novoStatus === STATUS_CONGELA) {
      patch.frozen_at = new Date();
      patch.frozen_remaining_days = getDiasRestantes(atual.origem_created_at, limite);
    } else if (antigo === STATUS_CONGELA && novoStatus === 'Pendente') {
      const restante = atual.frozen_remaining_days ?? getDiasRestantes(atual.origem_created_at, limite);
      patch.origem_created_at = getInicioAjustadoPosDescongelamento(restante, limite);
      patch.frozen_at = null;
      patch.frozen_remaining_days = null;
    }

    await this._patch(id, { ...patch, status: novoStatus }, usuario?.id);
    await controlesModel.adicionarHistorico(id, {
      type: 'status_change', user: usuario?.email || 'Sistema',
      message: `Status alterado de "${antigo}" para "${novoStatus}".`
    });
    return controlesModel.buscarCompleta(id);
  },

  async remover(id, usuario) {
    const atual = await controlesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Controle não encontrado');
    await controlesModel.deletarLogicamente(id, usuario?.id);
  },

  async _patch(id, patch, usuarioId) {
    const { execute } = require('../../config/database');
    const map = {
      status: 'status', origem_created_at: 'origem_created_at',
      frozen_at: 'frozen_at', frozen_remaining_days: 'frozen_remaining_days'
    };
    const sets = []; const params = []; let idx = 1;
    for (const [k, v] of Object.entries(patch)) {
      if (!map[k]) continue;
      sets.push(`${map[k]} = $${idx++}`); params.push(v);
    }
    if (!sets.length) return;
    sets.push(`atualizado_por = $${idx++}`); params.push(usuarioId || null);
    params.push(id);
    await execute(`UPDATE controles SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
  }
};

module.exports = { controlesService };
