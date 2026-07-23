// =============================================================
// Serviço de importação do backup (JSON Firebase) → PostgreSQL R2DN.
// Reutilizado pelo endpoint HTTP e pelo script CLI (import-firebase-json.js).
// - Corrige encoding (mojibake "Ã§" -> "ç")
// - Importa configurações, usuários, cotações e controles
// - modo "substituir" (padrão): substitui o banco atual pelo legado
//   (limpa cotações/controles e usuários, exceto o admin operacional).
// - modo "mesclar": idempotente — pula registros já existentes
//   (por número/e-mail) e preserva o que já está no banco.
// =============================================================

'use strict';

const { execute } = require('../../config/database');
const { cotacoesModel } = require('../cotacoes/cotacoesModel');
const { controlesModel } = require('../controles/controlesModel');
const { hashSenha } = require('../../utils/senha');

// E-mail do administrador operacional: nunca é removido/sobrescrito numa
// substituição, para não travar o operador para fora do sistema.
function adminProtegido() {
  return String(process.env.ADMIN_EMAIL || 'financeiro@rngerenciadora.com.br').trim().toLowerCase();
}

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

/**
 * Limpa o banco atual para dar lugar ao legado (modo "substituir").
 * - Apaga TODAS as cotações e controles (filhos via ON DELETE CASCADE).
 * - Apaga TODOS os usuários, exceto o administrador operacional.
 */
async function limparParaSubstituicao(protectedEmail) {
  // Cotações e controles: TRUNCATE ... CASCADE remove também as tabelas-filhas.
  await execute('TRUNCATE TABLE cotacoes CASCADE');
  await execute('TRUNCATE TABLE controles CASCADE');

  // Zera as auto-referências antes de apagar para não violar FK usuarios->usuarios.
  await execute('UPDATE usuarios SET criado_por = NULL, atualizado_por = NULL, deletado_por = NULL');
  const [, res] = await execute('DELETE FROM usuarios WHERE lower(email) <> $1', [protectedEmail]);
  return { usuariosRemovidos: res.rowCount || 0 };
}

async function importarConfig(global) {
  const c = mapConfig(global);
  const campos = Object.keys(c);
  const sets = campos.map((k, i) => `${k} = $${i + 1}`);
  await execute(
    `UPDATE configuracoes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = 1`,
    Object.values(c)
  );
}

async function importarUsuarios(global, senhaPadrao, { modo, protectedEmail }) {
  const permissions = global.userPermissions || {};
  const registered = global.registeredUsers || {};
  const hash = await hashSenha(senhaPadrao);

  const emails = new Set([...Object.keys(permissions), ...Object.keys(registered)]);
  let criados = 0;
  let atualizados = 0;
  let pulados = 0;
  let preservados = 0;

  for (const emailBruto of emails) {
    const email = String(emailBruto).trim().toLowerCase();
    if (!email) continue;

    // Nunca sobrescreve o admin operacional (preserva senha/sessão em uso).
    if (modo === 'substituir' && email === protectedEmail) {
      preservados++;
      continue;
    }

    const perm = permissions[emailBruto] || {};
    const nome = perm.name || registered[emailBruto] || email.split('@')[0];
    let perfil = perm.role || 'padrao';
    if (!PERFIS_VALIDOS.includes(perfil)) perfil = 'padrao';

    if (modo === 'mesclar') {
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
      continue;
    }

    // modo "substituir": upsert por e-mail (tabela já foi limpa, então normalmente insere).
    const [, res] = await execute(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, acesso_configuracoes, acesso_controles, ativo, precisa_trocar_senha)
       VALUES ($1,$2,$3,$4,$5,$6, TRUE, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         perfil = EXCLUDED.perfil,
         acesso_configuracoes = EXCLUDED.acesso_configuracoes,
         acesso_controles = EXCLUDED.acesso_controles,
         ativo = TRUE,
         updated_at = NOW()
       RETURNING (xmax = 0) AS inserido`,
      [nome, email, hash, perfil, !!perm.hasSettingsAccess, !!perm.hasControlAccess]
    );
    if (res.rows?.[0]?.inserido) criados++;
    else atualizados++;
  }
  return { criados, atualizados, pulados, preservados };
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

/** Lê o perfil/acessos atuais de um usuário (antes de uma substituição). */
async function capturarUsuario(email) {
  if (!email) return null;
  const [rows] = await execute(
    `SELECT nome, perfil, acesso_configuracoes, acesso_controles
       FROM usuarios WHERE lower(email) = $1`,
    [email]
  );
  return rows[0] || null;
}

/**
 * Garante o acesso de um usuário após a importação: define a senha informada e
 * restaura o perfil/acessos capturados antes da substituição. Assim, mesmo que a
 * senha desse usuário divirja no backup importado, o operador mantém o acesso.
 */
async function garantirAcesso({ email, senha, perfilAtual }) {
  const hash = await hashSenha(senha);
  const base = perfilAtual || {
    nome: email.split('@')[0],
    perfil: 'administrador',
    acesso_configuracoes: true,
    acesso_controles: true,
  };
  let perfil = base.perfil || 'padrao';
  if (!PERFIS_VALIDOS.includes(perfil)) perfil = 'padrao';

  const [, res] = await execute(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, acesso_configuracoes, acesso_controles, ativo, precisa_trocar_senha)
     VALUES ($1,$2,$3,$4,$5,$6, TRUE, FALSE)
     ON CONFLICT (email) DO UPDATE SET
       senha_hash = EXCLUDED.senha_hash,
       perfil = EXCLUDED.perfil,
       acesso_configuracoes = EXCLUDED.acesso_configuracoes,
       acesso_controles = EXCLUDED.acesso_controles,
       ativo = TRUE,
       precisa_trocar_senha = FALSE,
       updated_at = NOW()
     RETURNING (xmax = 0) AS inserido`,
    [base.nome || email.split('@')[0], email, hash, perfil, !!base.acesso_configuracoes, !!base.acesso_controles]
  );
  return { email, perfil, criado: !!res.rows?.[0]?.inserido };
}

/**
 * Orquestra a importação completa a partir do objeto JSON bruto do backup.
 * @param {object} dadosBrutos - conteúdo do backup ({ database, settings, ... })
 * @param {{ senhaPadrao?: string, modo?: 'substituir'|'mesclar',
 *           manterAcesso?: { email: string, senha: string } }} [opts]
 * @returns {Promise<object>} relatório da importação
 */
async function importarBackup(dadosBrutos, opts = {}) {
  const senhaPadrao = opts.senhaPadrao || process.env.IMPORT_DEFAULT_PASSWORD || 'Mudar@123';
  const modo = opts.modo === 'mesclar' ? 'mesclar' : 'substituir';
  const protectedEmail = adminProtegido();
  const dados = corrigirRecursivo(dadosBrutos);

  const global = dados.settings?.global || {};
  const quotations = dados.database?.main?.quotations || [];
  const controles = dados.database?.controles?.controles || [];

  // "Manter acesso": e-mail do operador + nova senha desejada no banco importado.
  const manterEmail = opts.manterAcesso?.email
    ? String(opts.manterAcesso.email).trim().toLowerCase()
    : null;
  const manterSenha = opts.manterAcesso?.senha || null;

  // Captura perfil/acessos do operador ANTES de limpar (para restaurar depois).
  let perfilOperador = null;
  if (manterEmail && manterSenha) {
    perfilOperador = await capturarUsuario(manterEmail);
  }

  let limpeza = null;
  if (modo === 'substituir') {
    limpeza = await limparParaSubstituicao(protectedEmail);
  }

  await importarConfig(global);
  const usuarios = await importarUsuarios(global, senhaPadrao, { modo, protectedEmail });
  const cotacoes = await importarCotacoes(quotations);
  const ctrl = await importarControles(controles);

  // Por último: aplica a senha do operador para garantir o acesso.
  let acessoMantido = null;
  if (manterEmail && manterSenha) {
    acessoMantido = await garantirAcesso({
      email: manterEmail,
      senha: manterSenha,
      perfilAtual: perfilOperador,
    });
  }

  return {
    modo,
    config: true,
    limpeza,
    adminPreservado: modo === 'substituir' ? protectedEmail : null,
    acessoMantido,
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
