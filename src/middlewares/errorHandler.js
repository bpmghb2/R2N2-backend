// =============================================================
// Middleware global de tratamento de erros.
// Registrado por último no app.js. Nunca expõe stack trace em produção.
// =============================================================

'use strict';

const { createLogger } = require('../utils/logger');
const logger = createLogger('ErrorHandler');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Erros de regra de negócio → 422
  if (err.tipo === 'NEGOCIO') {
    return res.status(422).json({ success: false, message: err.message });
  }
  // Erros de não encontrado → 404
  if (err.tipo === 'NAO_ENCONTRADO') {
    return res.status(404).json({ success: false, message: err.message });
  }
  // Erros de autorização/proteção → 403
  if (err.tipo === 'AUTORIZACAO') {
    return res.status(403).json({ success: false, message: err.message });
  }
  // Violação de UNIQUE no Postgres → 409
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Registro duplicado (violação de unicidade)' });
  }
  // Violação de FK → 409
  if (err.code === '23503') {
    return res.status(409).json({ success: false, message: 'Operação viola integridade referencial' });
  }

  logger.error('Erro não tratado', {
    rota: req.path,
    metodo: req.method,
    erro: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });

  return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
}

function notFoundHandler(req, res) {
  return res.status(404).json({ success: false, message: 'Rota não encontrada' });
}

module.exports = { errorHandler, notFoundHandler };
