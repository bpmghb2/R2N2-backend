// =============================================================
// Middleware de validação de entrada (Joi).
// Uso: validar(schema) valida req.body; validarQuery(schema) valida req.query.
// =============================================================

'use strict';

const { createLogger } = require('../utils/logger');
const logger = createLogger('Validacao');

function construir(fonte) {
  return (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req[fonte], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message
      }));
      logger.debug('Validação falhou', { rota: req.path, errors });
      return res.status(400).json({ success: false, message: 'Dados inválidos', errors });
    }

    req[fonte] = value;
    next();
  };
}

const validar = construir('body');
const validarQuery = construir('query');

module.exports = { validar, validarQuery };
