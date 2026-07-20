'use strict';

const Joi = require('joi');

const history = Joi.object({
  id: Joi.string().allow('', null),
  timestamp: Joi.string().allow('', null),
  type: Joi.string().valid('creation', 'status_change', 'general'),
  user: Joi.string().allow('', null),
  message: Joi.string().allow('', null)
});

const base = {
  number: Joi.string().allow(''),
  title: Joi.string().allow('').default(''),
  filledBy: Joi.string().allow('', null),
  date: Joi.string().allow('', null),
  status: Joi.string().valid('Rascunho', 'Pendente', 'Pendência Fornecedor', 'Concluído', 'Em Andamento', 'Cancelado'),
  fillType: Joi.string().allow('', null).valid('Assinatura de contrato', 'Revisão de contrato', 'Decisão', 'Retorno', ''),
  frozenAt: Joi.string().allow('', null),
  frozenRemainingDays: Joi.number().allow(null),
  createdAt: Joi.string().allow('', null),
  history: Joi.array().items(history).default([])
};

module.exports = {
  criar: Joi.object(base),
  atualizar: Joi.object(base).min(1),
  alterarStatus: Joi.object({
    status: Joi.string().valid('Rascunho', 'Pendente', 'Pendência Fornecedor', 'Concluído', 'Em Andamento', 'Cancelado').required()
  })
};
