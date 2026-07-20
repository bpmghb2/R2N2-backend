'use strict';

const Joi = require('joi');

module.exports = {
  atualizar: Joi.object({
    client_identification: Joi.string().allow('').max(200),
    corporate_identity: Joi.string().allow('').max(200),
    control_numbering_prefix: Joi.string().allow('').max(30),
    default_project_name: Joi.string().allow('').max(200),
    hide_total_costs_chart: Joi.boolean(),
    sort_by_cheapest: Joi.boolean(),
    prazo_compras: Joi.number().integer().min(0).max(365),
    prazo_contratos: Joi.number().integer().min(0).max(365),
    alcada_gerenciadora_max_valor: Joi.number().min(0),
    dashboard_export_filename: Joi.string().allow('').max(300),
    purchase_order_filename: Joi.string().allow('').max(300),
    supplier_info_text_1: Joi.string().allow(''),
    supplier_info_text_2: Joi.string().allow(''),
    cno: Joi.string().allow('').max(60),
    control_access_emails: Joi.string().allow(''),
    pending_access_emails: Joi.string().allow(''),
    warning_text_template: Joi.string().allow(''),
    email_template: Joi.string().allow(''),
    logo_url: Joi.string().allow(''),
    logo_height: Joi.number().integer().min(10).max(400)
  }).min(1)
};
