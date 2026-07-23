// =============================================================
// Service de Cotações — regras de negócio.
// =============================================================

'use strict';

const { cotacoesModel } = require('./cotacoesModel');
const { configuracoesModel } = require('../configuracoes/configuracoesModel');
const { errNegocio, errNaoEncontrado } = require('../../utils/erros');
const { getDiasRestantes, getInicioAjustadoPosDescongelamento } = require('../../utils/prazo');

const STATUS_CONGELA = 'Aguardando Fornecedor';

const cotacoesService = {
  async listar({ pagina, limite, filtros }) {
    const p = Math.max(1, pagina);
    const l = Math.min(200, Math.max(1, limite));
    const offset = (p - 1) * l;
    const [registros, total] = await Promise.all([
      cotacoesModel.listar({ limite: l, offset, filtros }),
      cotacoesModel.contarTotal(filtros)
    ]);
    return { registros, total };
  },

  buscarPorId(id) {
    return cotacoesModel.buscarCompleta(id);
  },

  /** Gera o próximo número de cotação: prefixo + sequência com 4 dígitos. */
  async gerarNumero() {
    const { last_quote_number, control_numbering_prefix } = await configuracoesModel.proximoNumeroCotacao();
    const seq = String(last_quote_number).padStart(4, '0');
    return `${control_numbering_prefix || 'COT-'}${seq}`;
  },

  async criar(dominio, usuario) {
    const number = dominio.number && dominio.number.trim() ? dominio.number.trim() : await this.gerarNumero();

    const novo = {
      ...dominio,
      number,
      status: dominio.status || 'Rascunho',
      history: dominio.history && dominio.history.length ? dominio.history : [{
        type: 'creation', user: usuario?.email || 'Sistema',
        message: 'Cotação criada no sistema.', timestamp: new Date().toISOString()
      }]
    };

    const id = await cotacoesModel.criar(novo, usuario?.id);
    return cotacoesModel.buscarCompleta(id);
  },

  async atualizar(id, dominio, usuario) {
    const atual = await cotacoesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Cotação não encontrada');
    if (atual.locked && dominio.locked !== false) {
      throw errNegocio('Cotação bloqueada. Desbloqueie antes de editar.');
    }
    const ok = await cotacoesModel.atualizar(id, { ...dominio, number: dominio.number || atual.numero }, usuario?.id);
    if (!ok) throw errNaoEncontrado('Cotação não encontrada');
    return cotacoesModel.buscarCompleta(id);
  },

  /**
   * Altera o status aplicando as regras de timer/histórico.
   * @param {object} opts { comentario, justificativa }
   */
  async alterarStatus(id, novoStatus, usuario, opts = {}) {
    const atual = await cotacoesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Cotação não encontrada');

    const antigo = atual.status;
    if (antigo === novoStatus) return cotacoesModel.buscarCompleta(id);

    // Rascunho -> Pendente exige responsável e inicia o timer
    if (antigo === 'Rascunho' && novoStatus === 'Pendente') {
      if (!atual.filled_by) throw errNegocio('Informe o "Responsável pelo Preenchimento" antes de iniciar o prazo.');
    }

    const patch = {};
    const limite = atual.prazo_dias || (atual.format_type === 'Compras' ? 3 : 5);

    if (novoStatus === 'Pendente' && (antigo === 'Rascunho' || !atual.origem_created_at)) {
      patch.origem_created_at = new Date();
      patch.frozen_at = null;
      patch.frozen_remaining_days = null;
    } else if (novoStatus === STATUS_CONGELA) {
      // congela o timer
      patch.frozen_at = new Date();
      patch.frozen_remaining_days = getDiasRestantes(atual.origem_created_at, limite);
    } else if (antigo === STATUS_CONGELA && novoStatus === 'Pendente') {
      // descongela, recalculando a origem para preservar o restante
      const restante = atual.frozen_remaining_days ?? getDiasRestantes(atual.origem_created_at, limite);
      patch.origem_created_at = getInicioAjustadoPosDescongelamento(restante, limite);
      patch.frozen_at = null;
      patch.frozen_remaining_days = null;
    }

    await this._patchCabecalho(id, patch, usuario?.id);

    await cotacoesModel.adicionarHistorico(id, {
      type: 'status_change', fromStatus: antigo, toStatus: novoStatus,
      user: usuario?.email || 'Sistema',
      message: `Status alterado de "${antigo}" para "${novoStatus}".${opts.comentario ? ' ' + opts.comentario : ''}`,
      justification: opts.justificativa
    });
    await this._patchCabecalho(id, { status: novoStatus }, usuario?.id);

    return cotacoesModel.buscarCompleta(id);
  },

  /** Aprovação: registra fornecedor comprado, justificativa (se divergente), bloqueia. */
  async aprovar(id, { approvedSupplierId, justificativa, statusFinal }, usuario) {
    const atual = await cotacoesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Cotação não encontrada');
    if (!approvedSupplierId) throw errNegocio('Selecione o fornecedor adquirido.');

    const divergente = atual.manager_choice_supplier_ref &&
      atual.manager_choice_supplier_ref !== approvedSupplierId;
    if (divergente && !justificativa) {
      throw errNegocio('Justificativa obrigatória quando o fornecedor comprado difere do recomendado.');
    }

    const status = statusFinal || 'Aprovado';
    await this._patchCabecalho(id, {
      status,
      aprovacao_data: new Date().toISOString().slice(0, 10),
      approved_supplier_ref: approvedSupplierId,
      approved_supplier_justificativa: justificativa || null,
      locked: true,
      frozen_at: null,
      frozen_remaining_days: null
    }, usuario?.id);

    // Resolve o NOME do fornecedor (o approvedSupplierId é o external_id "sup-...").
    const completa = await cotacoesModel.buscarCompleta(id);
    const forn = (completa?.suppliers || []).find((s) => s.id === approvedSupplierId);
    const nomeFornecedor = forn?.name || approvedSupplierId;

    await cotacoesModel.adicionarHistorico(id, {
      type: 'approval', fromStatus: atual.status, toStatus: status,
      user: usuario?.email || 'Sistema',
      message: `Cotação aprovada. Fornecedor adquirido: ${nomeFornecedor}.`,
      justification: justificativa
    });
    return cotacoesModel.buscarCompleta(id);
  },

  /** Clona uma cotação como novo rascunho, re-mapeando IDs e limpando aprovação. */
  async clonar(id, usuario) {
    const origem = await cotacoesModel.buscarCompleta(id);
    if (!origem) throw errNaoEncontrado('Cotação não encontrada');

    const number = await this.gerarNumero();
    const clone = {
      ...origem,
      number,
      status: 'Rascunho',
      locked: false,
      approvalDate: undefined,
      managerChoiceSupplierId: undefined,
      managerChoiceJustification: undefined,
      approvedSupplierId: undefined,
      approvedSupplierJustification: undefined,
      frozenAt: undefined,
      frozenRemainingDays: undefined,
      emailSentAt: undefined,
      createdAt: undefined,
      history: [{
        type: 'creation', user: usuario?.email || 'Sistema',
        message: `Clonado em modo Rascunho a partir da cotação anterior ${origem.number}.`,
        timestamp: new Date().toISOString()
      }]
    };
    delete clone.id;

    const novoId = await cotacoesModel.criar(clone, usuario?.id);
    return cotacoesModel.buscarCompleta(novoId);
  },

  async remover(id, usuario) {
    const atual = await cotacoesModel.buscarCabecalho(id);
    if (!atual) throw errNaoEncontrado('Cotação não encontrada');
    await cotacoesModel.deletarLogicamente(id, usuario?.id);
  },

  /** Atualiza apenas campos do cabeçalho (uso interno) preservando as coleções. */
  async _patchCabecalho(id, patch, usuarioId) {
    const { execute } = require('../../config/database');
    const map = {
      status: 'status', origem_created_at: 'origem_created_at', frozen_at: 'frozen_at',
      frozen_remaining_days: 'frozen_remaining_days', aprovacao_data: 'aprovacao_data',
      approved_supplier_ref: 'approved_supplier_ref',
      approved_supplier_justificativa: 'approved_supplier_justificativa', locked: 'locked'
    };
    const sets = [];
    const params = [];
    let idx = 1;
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k];
      if (!col) continue;
      sets.push(`${col} = $${idx++}`);
      params.push(v);
    }
    if (!sets.length) return;
    sets.push(`atualizado_por = $${idx++}`); params.push(usuarioId || null);
    params.push(id);
    await execute(`UPDATE cotacoes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
  },

  /** Calcula o total por fornecedor (Σ qtd×preço + frete + impostos). */
  calcularTotais(cotacao) {
    const totais = {};
    for (const s of cotacao.suppliers || []) {
      let soma = 0;
      for (const it of cotacao.items || []) {
        const preco = it.prices?.[s.id];
        if (preco != null) soma += Number(it.quantity || 0) * Number(preco);
      }
      totais[s.id] = soma + Number(s.freight || 0) + Number(s.taxes || 0);
    }
    return totais;
  }
};

module.exports = { cotacoesService };
