// =============================================================
// Ponto de entrada do servidor R2DN.
// Carrega variáveis de ambiente, testa o banco e sobe o Express.
// =============================================================

'use strict';

require('dotenv').config();

const app = require('./app');
const { testarConexao, pool } = require('./config/database');
const { createLogger } = require('./utils/logger');

const logger = createLogger('Server');
const PORT = Number(process.env.PORT || 3002);

async function iniciar() {
  try {
    await testarConexao();
  } catch (error) {
    logger.error('Não foi possível conectar ao PostgreSQL. Verifique o .env e o servidor R2DN.', {
      erro: error.message
    });
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`R2DN API rodando na porta ${PORT}`, {
      ambiente: process.env.NODE_ENV,
      docs: `http://localhost:${PORT}/api/docs`
    });
  });

  // Encerramento gracioso
  const encerrar = async (sinal) => {
    logger.info(`Recebido ${sinal}. Encerrando...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

iniciar();
