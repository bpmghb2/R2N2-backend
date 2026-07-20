// =============================================================
// Cálculo de prazos em dias úteis (pula sábados e domingos).
// Portado de ProjetoCRU/src/utils.ts para a camada de serviço.
// =============================================================

'use strict';

function ehFimDeSemana(data) {
  const d = data.getDay();
  return d === 0 || d === 6;
}

/** Retorna uma nova data somando N dias úteis a partir de `base`. */
function adicionarDiasUteis(base, dias) {
  const data = new Date(base);
  let adicionados = 0;
  const passo = dias >= 0 ? 1 : -1;
  const total = Math.abs(dias);
  while (adicionados < total) {
    data.setDate(data.getDate() + passo);
    if (!ehFimDeSemana(data)) adicionados++;
  }
  return data;
}

/**
 * Dias úteis restantes até o prazo.
 * @param {string|Date} origemCreatedAt - início da contagem (ISO ou Date)
 * @param {number} totalDiasUteis - prazo total em dias úteis
 * @param {Date} [alvo] - data de referência (default: hoje)
 * @returns {number} pode ser negativo (atrasado)
 */
function getDiasRestantes(origemCreatedAt, totalDiasUteis = 5, alvo) {
  if (!origemCreatedAt) return totalDiasUteis;

  const criacao = origemCreatedAt instanceof Date ? new Date(origemCreatedAt) : new Date(origemCreatedAt);
  criacao.setHours(0, 0, 0, 0);

  const deadline = adicionarDiasUteis(criacao, totalDiasUteis);
  const hoje = alvo ? new Date(alvo) : new Date();
  hoje.setHours(0, 0, 0, 0);

  let restante = 0;
  const atual = new Date(hoje);
  if (atual.getTime() <= deadline.getTime()) {
    while (atual.getTime() < deadline.getTime()) {
      atual.setDate(atual.getDate() + 1);
      if (!ehFimDeSemana(atual)) restante++;
    }
    return restante;
  }
  while (atual.getTime() > deadline.getTime()) {
    atual.setDate(atual.getDate() - 1);
    if (!ehFimDeSemana(atual)) restante--;
  }
  return restante;
}

/**
 * Recalcula a data de início (origem_created_at) para retomar o timer após um
 * congelamento, preservando os dias restantes congelados.
 * Retorna um ISO timestamp.
 */
function getInicioAjustadoPosDescongelamento(frozenRemainingDays, totalDiasUteis) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const novoDeadline = adicionarDiasUteis(hoje, frozenRemainingDays);
  const novoInicio = adicionarDiasUteis(novoDeadline, -totalDiasUteis);

  const agora = new Date();
  novoInicio.setHours(agora.getHours(), agora.getMinutes(), agora.getSeconds(), 0);
  return novoInicio.toISOString();
}

module.exports = {
  adicionarDiasUteis,
  getDiasRestantes,
  getInicioAjustadoPosDescongelamento
};
