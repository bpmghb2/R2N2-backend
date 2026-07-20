// =============================================================
// Logger estruturado (Winston).
// Uso: const { createLogger } = require('../utils/logger');
//      const logger = createLogger('MeuContexto');
// =============================================================

'use strict';

const winston = require('winston');

const nivel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const formatoBase = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const baseLogger = winston.createLogger({
  level: nivel,
  format: formatoBase,
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? formatoBase
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, contexto, ...meta }) => {
              const ctx = contexto ? `[${contexto}] ` : '';
              const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} ${level} ${ctx}${message}${extra}`;
            })
          )
    })
  ]
});

/** Cria um logger "filho" com um contexto fixo (nome do módulo). */
function createLogger(contexto) {
  return baseLogger.child({ contexto });
}

module.exports = { createLogger, baseLogger };
