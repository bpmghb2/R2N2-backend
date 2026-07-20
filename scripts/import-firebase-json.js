// =============================================================
// Importa o backup do Firebase (JSON) para o PostgreSQL R2DN.
// - Corrige o encoding (mojibake: "Ã§" -> "ç" etc.)
// - Migra configurações, usuários, cotações e controles
// - Idempotente: pula registros já existentes (por número/e-mail)
//
// Uso: npm run import:json         (usa IMPORT_JSON_PATH do .env)
//      node scripts/import-firebase-json.js caminho/para/backup.json
// =============================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, execute } = require('../src/config/database');
const { cotacoesModel } = require('../src/modules/cotacoes/cotacoesModel');
const { controlesModel } = require('../src/modules/controles/controlesModel');
const { hashSenha } = require('../src/utils/senha');

// ---------- Correção de encoding (double-encoded UTF-8) ----------
function corrigirTexto(s) {
  if (typeof s !== 'string') return s;
  if (!/[ÃÂ]/.test(s)) return s; // já está correto
  try {
    return Buffer.from(s, 'latin1').toString('utf8');
  } catch {
    return s;
  }
}
function corrigirRecursivo(obj) {
  if (typeof obj === 'string') return corrigirTexto(obj);
  if (Array.isArray(obj)) return obj.map(corrigirRecursivo);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = corrigirRecursivo(v);
    return out;
  }
  return obj;
}

// ---------- Mapeamento de settings -> colunas de configuracoes ----------
function mapConfig(g = {}) {
  return {
    client_identification: g.clientIdentification || '',
    corporate_identity: g.corporateIdentity || '',
    control_numbering_prefix: g.controlNumberingPrefix || 'COT-2026-',
    default_project_name: g.defaultProjectName || '',
    hide_total_costs_chart: !!g.hideTotalCostsChart,
    sort_by_cheapest: !!g.sortByCheapest,
    prazo_compras: g.prazoCompras ?? 3,
    prazo_contratos: g.prazoContratos ?? 5,
    alcada_gerenciadora_max_valor: g.alcadaGerenciadoraMaxValor ?? 2000,
    dashboard_export_filename: g.dashboardExportFilename || '{{NUMERO}} - {{TITULO}} - {{DATA}}',
    purchase_order_filename: g.purchaseOrderFilename || 'Pedido de compras - {{FORNECEDOR}} - {{NUMERO}}',
    supplier_info_text_1: g.supplierInfoText1 || '',
    supplier_info_text_2: g.supplierInfoText2 || '',
    cno: g.cno || '',
    control_access_emails: g.controlAccessEmails || '',
    pending_access_emails: g.pendingAccessEmails || '',
    warning_text_template: g.warningTextTemplate || '',
    email_template: g.emailTemplate || '',
    logo_url: g.logoUrl || '',
    logo_height: g.logoHeight ?? 42,
    last_quote_number: g.lastQuoteNumber ?? 0,
    last_control_number: g.lastControlNumber ?? 0
  };
}

const PERFIS_VALIDOS = ['administrador', 'ti', 'gestor', 'padrao', 'visitante', 'cliente'];

async function importarConfig(global) {
  const c = mapConfig(global);
  const campos = Object.keys(c);
  const sets = campos.map((k, i) => `${k} = $${i + 1}`);
  await execute(
    `UPDATE configuracoes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = 1`,
    Object.values(c)
  );
  console.log('✔ Configurações importadas.');
}

async function importarUsuarios(global) {
  const permissions = global.userPermissions || {};
  const registered = global.registeredUsers || {};
  const senhaPadrao = process.env.IMPORT_DEFAULT_PASSWORD || 'Mudar@123';
  const hash = await hashSenha(senhaPadrao);

  // consolida e-mails de ambas as fontes
  const emails = new Set([...Object.keys(permissions), ...Object.keys(registered)]);
  let criados = 0, pulados = 0;

  for (const emailBruto of emails) {
    const email = String(emailBruto).trim().toLowerCase();
    if (!email) continue;

    const perm = permissions[emailBruto] || {};
    const nome = perm.name || registered[emailBruto] || email.split('@')[0];
    let perfil = (perm.role || 'padrao');
    if (!PERFIS_VALIDOS.includes(perfil)) perfil = 'padrao';

    const [existe] = await execute('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.length) { pulados++; continue; }

    await execute(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, acesso_configuracoes, acesso_controles, ativo, precisa_trocar_senha)
       VALUES ($1,$2,$3,$4,$5,$6, TRUE, TRUE)`,
      [nome, email, hash, perfil, !!perm.hasSettingsAccess, !!perm.hasControlAccess]
    );
    criados++;
  }
  console.log(`✔ Usuários: ${criados} criado(s), ${pulados} já existente(s). Senha temporária: "${senhaPadrao}" (troca obrigatória).`);
}

async function importarCotacoes(quotations = []) {
  let criadas = 0, puladas = 0;
  for (const q of quotations) {
    const [existe] = await execute('SELECT id FROM cotacoes WHERE numero = $1', [q.number]);
    if (existe.length) { puladas++; continue; }
    await cotacoesModel.criar(q, null);
    criadas++;
  }
  console.log(`✔ Cotações: ${criadas} importada(s), ${puladas} já existente(s).`);
}

async function importarControles(controles = []) {
  let criados = 0, pulados = 0;
  for (const c of controles) {
    const [existe] = await execute('SELECT id FROM controles WHERE numero = $1', [c.number]);
    if (existe.length) { pulados++; continue; }
    await controlesModel.criar(c, null);
    criados++;
  }
  console.log(`✔ Controles: ${criados} importado(s), ${pulados} já existente(s).`);
}

async function run() {
  const caminhoArg = process.argv[2];
  const caminho = caminhoArg
    ? path.resolve(caminhoArg)
    : path.resolve(__dirname, '..', process.env.IMPORT_JSON_PATH || '../backup_firebase_completo_2026-07-17.json');

  if (!fs.existsSync(caminho)) {
    console.error(`Arquivo de backup não encontrado: ${caminho}`);
    console.error('Informe o caminho: node scripts/import-firebase-json.js <arquivo.json>  (ou defina IMPORT_JSON_PATH no .env)');
    process.exit(1);
  }

  console.log(`Lendo backup: ${caminho}`);
  const bruto = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  const dados = corrigirRecursivo(bruto);

  const global = dados.settings?.global || {};
  const quotations = dados.database?.main?.quotations || [];
  const controles = dados.database?.controles?.controles || [];

  console.log(`Registros no backup: ${quotations.length} cotações, ${controles.length} controles, ${Object.keys(global.userPermissions || {}).length} permissões de usuário.`);

  await importarConfig(global);
  await importarUsuarios(global);
  await importarCotacoes(quotations);
  await importarControles(controles);

  console.log('\nImportação concluída com sucesso.');
  await pool.end();
}

run().catch((err) => {
  console.error('Erro na importação:', err.message);
  console.error(err.stack);
  process.exit(1);
});
