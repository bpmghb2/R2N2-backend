// =============================================================
// Serviço de importação do backup (JSON Firebase) → PostgreSQL R2DN.
// Reutilizado pelo endpoint HTTP e pelo script CLI (import-firebase-json.js).
// - Corrige encoding (mojibake "Ã§" -> "ç")
// - Importa configurações, usuários, cotações e controles
// - Idempotente: pula registros já existentes (por número/e-mail)
// =============================================================

'use strict';

const { execute } = require('../../config/database');
const { cotacoesModel } = require('../cotacoes/cotacoesModel');
const { controlesModel } = require('../controles/controlesModel');
const { hashSenha } = require('../../utils/senha');

// ---------- Correção de encoding (double-encoded UTF-8) ----------
function corrigirTexto(s) {
  if (typeof s !== 'string') return s;
  if (!/[ÃÂ]/.test(s)) return s;
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

// ---------- Mapeamento settings -> colunas de configuracoes ----------
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
    last_control_number: g.lastControlNumber ?? 0,
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
}

async function importarUsuarios(global, senhaPadrao) {
  const permissions = global.userPermissions || {};
  const registered = global.registeredUsers || {};
  const hash = await hashSenha(senhaPadrao);

  const emails = new Set([...Object.keys(permissions), ...Object.keys(registered)]);
  let criados = 0;
  let pulados = 0;

  for (const emailBruto of emails) {
    const email = String(emailBruto).trim().toLowerCase();
    if (!email) continue;

    const perm = permissions[emailBruto] || {};
    const nome = perm.name || registered[emailBruto] || email.split('@')[0];
    let perfil = perm.role || 'padrao';
    if (!PERFIS_VALIDOS.includes(perfil)) perfil = 'padrao';

    const [existe] = await execute('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.length) {
      pulados++;
      continue;
    }

    await execute(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, acesso_configuracoes, acesso_controles, ativo, precisa_trocar_senha)
       VALUES ($1,$2,$3,$4,$5,$6, TRUE, TRUE)`,
      [nome, email, hash, perfil, !!perm.hasSettingsAccess, !!perm.hasControlAccess]
    );
    criados++;
  }
  return { criados, pulados };
}

async function importarCotacoes(quotations = []) {
  let criadas = 0;
  let puladas = 0;
  for (const q of quotations) {
    const [existe] = await execute('SELECT id FROM cotacoes WHERE numero = $1', [q.number]);
    if (existe.length) {
      puladas++;
      continue;
    }
    await cotacoesModel.criar(q, null);
    criadas++;
  }
  return { criadas, puladas };
}

async function importarControles(controles = []) {
  let criados = 0;
  let pulados = 0;
  for (const c of controles) {
    const [existe] = await execute('SELECT id FROM controles WHERE numero = $1', [c.number]);
    if (existe.length) {
      pulados++;
      continue;
    }
    await controlesModel.criar(c, null);
    criados++;
  }
  return { criados, pulados };
}

/**
 * Orquestra a importação completa a partir do objeto JSON bruto do backup.
 * @param {object} dadosBrutos - conteúdo do backup ({ database, settings, ... })
 * @param {{ senhaPadrao?: string }} [opts]
 * @returns {Promise<object>} relatório da importação
 */
async function importarBackup(dadosBrutos, opts = {}) {
  const senhaPadrao = opts.senhaPadrao || process.env.IMPORT_DEFAULT_PASSWORD || 'Mudar@123';
  const dados = corrigirRecursivo(dadosBrutos);

  const global = dados.settings?.global || {};
  const quotations = dados.database?.main?.quotations || [];
  const controles = dados.database?.controles?.controles || [];

  await importarConfig(global);
  const usuarios = await importarUsuarios(global, senhaPadrao);
  const cotacoes = await importarCotacoes(quotations);
  const ctrl = await importarControles(controles);

  return {
    config: true,
    usuarios,
    cotacoes,
    controles: ctrl,
    lidos: {
      quotations: quotations.length,
      controles: controles.length,
      usuarios: new Set([
        ...Object.keys(global.userPermissions || {}),
        ...Object.keys(global.registeredUsers || {}),
      ]).size,
    },
    senhaPadrao,
  };
}

module.exports = {
  importarBackup,
  corrigirRecursivo,
  mapConfig,
};
