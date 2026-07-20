// =============================================================
// Cria (ou atualiza) o primeiro usuário administrador do R2DN.
// Uso: node scripts/seed-admin.js   (usa ADMIN_EMAIL / ADMIN_SENHA do .env)
// =============================================================

'use strict';

require('dotenv').config();

const { pool, execute } = require('../src/config/database');
const { hashSenha } = require('../src/utils/senha');

async function run() {
  const email = String(process.env.ADMIN_EMAIL || 'financeiro@rngerenciadora.com.br').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA;

  if (!senha || senha === 'ALTERAR_ANTES_DE_USAR') {
    console.error('Defina ADMIN_SENHA no .env antes de rodar o seed.');
    process.exit(1);
  }

  const hash = await hashSenha(senha);

  const [existentes] = await execute('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (existentes.length) {
    await execute(
      `UPDATE usuarios SET senha_hash = $1, perfil = 'administrador',
         acesso_configuracoes = TRUE, acesso_controles = TRUE, ativo = TRUE,
         precisa_trocar_senha = FALSE, updated_at = NOW()
       WHERE email = $2`,
      [hash, email]
    );
    console.log(`Administrador atualizado: ${email}`);
  } else {
    await execute(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, acesso_configuracoes, acesso_controles, ativo)
       VALUES ('Administrador', $1, $2, 'administrador', TRUE, TRUE, TRUE)`,
      [email, hash]
    );
    console.log(`Administrador criado: ${email}`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error('Erro no seed:', err.message);
  process.exit(1);
});
