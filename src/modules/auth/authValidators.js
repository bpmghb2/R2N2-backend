'use strict';

const Joi = require('joi');

module.exports = {
  login: Joi.object({
    email: Joi.string().trim().max(200).required()
      .messages({ 'string.empty': 'Informe o e-mail ou usuário' }),
    senha: Joi.string().max(100).required()
      .messages({ 'string.empty': 'Informe a senha' }),
    rememberMe: Joi.boolean()
  })
};
