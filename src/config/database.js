// =============================================================
// Configuração de acesso ao PostgreSQL (banco R2DN)
// SQL direto via driver `pg` — sem ORM (decisão arquitetural BPM).
// Expõe uma função `execute` que retorna [rows, resultCompleto],
// padronizando o acesso em todos os models.
// =============================================================

'use strict';

const { Pool } = require('pg');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Database');

const pool = new Pool({
  host:               process.env.DB_HOST,
  port:               Number(process.env.DB_PORT || 5432),
  database:           process.env.DB_NAME,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  max:                Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  logger.error('Erro inesperado no pool de conexões', { erro: err.message });
});

/**
 * Executa uma query parametrizada.
 * @param {string} sql   - SQL com placeholders $1, $2, ...
 * @param {Array}  params - valores dos placeholders
 * @returns {Promise<[Array, import('pg').QueryResult]>} [rows, result]
 */
async function execute(sql, params = []) {
  const inicio = Date.now();
  try {
    const result = await pool.query(sql, params);
    const duracao = Date.now() - inicio;
    if (duracao > 500) {
      logger.warn('Query lenta', { duracao, sql: sql.slice(0, 120) });
    }
    return [result.rows, result];
  } catch (error) {
    logger.error('Erro na execução da query', { erro: error.message, sql: sql.slice(0, 120) });
    throw error;
  }
}

/**
 * Executa uma sequência de operações dentro de uma transação.
 * Recebe um callback que usa o client fornecido (client.query(...)).
 * Faz COMMIT em sucesso e ROLLBACK em erro.
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 */
async function transacao(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await callback(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Testa a conexão com o banco (chamado no boot do servidor). */
async function testarConexao() {
  const [rows] = await execute('SELECT NOW() AS agora, current_database() AS banco');
  logger.info('Conexão com PostgreSQL estabelecida', {
    banco: rows[0].banco,
    host:  process.env.DB_HOST
  });
  return rows[0];
}

module.exports = { pool, execute, transacao, testarConexao };
