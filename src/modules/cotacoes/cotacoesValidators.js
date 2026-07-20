'use strict';

const Joi = require('joi');

const supplier = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().allow('').default(''),
  contact: Joi.string().allow('', null),
  paymentTerm: Joi.string().allow('', null),
  freight: Joi.number().default(0),
  taxes: Joi.number().default(0)
});

const item = Joi.object({
  id: Joi.string().required(),
  number: Joi.number().default(0),
  description: Joi.string().allow('').default(''),
  unit: Joi.string().allow('').default('Un'),
  quantity: Joi.number().default(0),
  prices: Joi.object().pattern(Joi.string(), Joi.number().allow(null)).default({})
});

const incExc = Joi.object({
  id: Joi.string().allow('', null),
  number: Joi.number().default(0),
  service: Joi.string().allow('').default(''),
  description: Joi.string().allow('').default('')
});

const history = Joi.object({
  id: Joi.string().allow('', null),
  timestamp: Joi.string().allow('', null),
  type: Joi.string().valid('creation', 'status_change', 'approval', 'unlocked', 'general', 'update'),
  fromStatus: Joi.string().allow('', null),
  toStatus: Joi.string().allow('', null),
  user: Joi.string().allow('', null),
  message: Joi.string().allow('', null),
  justification: Joi.string().allow('', null)
});

const base = {
  number: Joi.string().allow(''),
  title: Joi.string().allow('').default(''),
  date: Joi.string().allow('', null),
  projectName: Joi.string().allow('').default(''),
  clientName: Joi.string().allow('').default(''),
  engineerName: Joi.string().allow('').default(''),
  status: Joi.string().valid('Rascunho', 'Pendente', 'Aprovado', 'Recusado', 'Aguardando Fornecedor', 'Aprovado pela Gerenciadora'),
  formatType: Joi.string().valid('Compras', 'Serviço', 'Contratos'),
  prazoDias: Joi.number().integer().allow(null),
  locked: Joi.boolean(),
  savedToCloud: Joi.boolean(),
  approvalDate: Joi.string().allow('', null),
  managerChoiceSupplierId: Joi.string().allow('', null),
  managerChoiceJustification: Joi.string().allow('', null),
  approvedSupplierId: Joi.string().allow('', null),
  approvedSupplierJustification: Joi.string().allow('', null),
  frozenAt: Joi.string().allow('', null),
  frozenRemainingDays: Joi.number().allow(null),
  emailSentAt: Joi.string().allow('', null),
  filledBy: Joi.string().allow('', null),
  createdAt: Joi.string().allow('', null),
  suppliers: Joi.array().items(supplier).default([]),
  items: Joi.array().items(item).default([]),
  inclusions: Joi.array().items(incExc).default([]),
  exclusions: Joi.array().items(incExc).default([]),
  history: Joi.array().items(history).default([])
};

module.exports = {
  criar: Joi.object(base),
  atualizar: Joi.object(base).min(1),
  alterarStatus: Joi.object({
    status: Joi.string().valid('Rascunho', 'Pendente', 'Aprovado', 'Recusado', 'Aguardando Fornecedor', 'Aprovado pela Gerenciadora').required(),
    comentario: Joi.string().allow('', null),
    justificativa: Joi.string().allow('', null)
  }),
  aprovar: Joi.object({
    approvedSupplierId: Joi.string().required(),
    justificativa: Joi.string().allow('', null),
    statusFinal: Joi.string().valid('Aprovado', 'Aprovado pela Gerenciadora').default('Aprovado')
  })
};
