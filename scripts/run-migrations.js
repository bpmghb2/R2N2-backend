// =============================================================
// Executa as migrations SQL pendentes, em ordem, no banco R2DN.
// Uso: npm run migrate
// =============================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'sql', 'migrations');

async function garantirTabelaControle(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao       VARCHAR(10)  PRIMARY KEY,
      descricao    VARCHAR(200) NOT NULL,
      executado_em TIMESTAMP    NOT NULL DEFAULT NOW()
    );
  `);
}

async function migrationsAplicadas(client) {
  const { rows } = await client.query('SELECT versao FROM schema_migrations');
  return new Set(rows.map((r) => r.versao));
}

async function run() {
  const arquivos = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    await garantirTabelaControle(client);
    const aplicadas = await migrationsAplicadas(client);

    let executadas = 0;
    for (const arquivo of arquivos) {
      const versao = arquivo.split('_')[0];
      if (aplicadas.has(versao)) {
        console.log(`• ${arquivo} — já aplicada (${versao}), pulando`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf8');
      console.log(`▶ Aplicando ${arquivo} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        executadas++;
        console.log(`✔ ${arquivo} aplicada`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[ERRO] Falha em ${arquivo}: ${error.message}`);
        throw error;
      }
    }

    console.log(`\nConcluído. ${executadas} migration(s) aplicada(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Erro nas migrations:', err.message);
  process.exit(1);
});
