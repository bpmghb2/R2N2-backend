// =============================================================
// Schemas de validação (Joi) do módulo Usuários.
// =============================================================

'use strict';

const Joi = require('joi');

const PERFIS = ['administrador', 'ti', 'gestor', 'padrao', 'visitante', 'cliente'];

const usuariosValidators = {
  criar: Joi.object({
    nome: Joi.string().trim().min(2).max(150).required(),
    email: Joi.string().trim().lowercase().max(200).required()
      .messages({ 'string.empty': 'E-mail é obrigatório' }),
    senha: Joi.string().min(6).max(100).required(),
    perfil: Joi.string().valid(...PERFIS).default('padrao'),
    acesso_configuracoes: Joi.boolean(),
    acesso_controles: Joi.boolean(),
    ativo: Joi.boolean(),
    precisa_trocar_senha: Joi.boolean()
  }),

  atualizar: Joi.object({
    nome: Joi.string().trim().min(2).max(150),
    perfil: Joi.string().valid(...PERFIS),
    acesso_configuracoes: Joi.boolean(),
    acesso_controles: Joi.boolean(),
    ativo: Joi.boolean()
  }).min(1),

  redefinirSenha: Joi.object({
    senha: Joi.string().min(6).max(100).required(),
    precisa_trocar_senha: Joi.boolean().default(false)
  })
};

module.exports = usuariosValidators;
