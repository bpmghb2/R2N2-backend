// =============================================================
// Model de Usuários — acesso ao banco (apenas SQL).
// =============================================================

'use strict';

const { execute } = require('../../config/database');

const COLUNAS_PUBLICAS = `
  id, nome, email, perfil, acesso_configuracoes, acesso_controles,
  ativo, precisa_trocar_senha, ultimo_acesso, created_at, updated_at
`;

const usuariosModel = {
  async listar({ limite, offset, filtros = {} }) {
    const condicoes = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (filtros.perfil) {
      condicoes.push(`perfil = $${idx++}`);
      params.push(filtros.perfil);
    }
    if (filtros.ativo != null) {
      condicoes.push(`ativo = $${idx++}`);
      params.push(filtros.ativo);
    }
    if (filtros.busca) {
      condicoes.push(`(nome ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${filtros.busca}%`);
      idx++;
    }

    params.push(limite, offset);
    const [rows] = await execute(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuarios
       WHERE ${condicoes.join(' AND ')}
       ORDER BY nome ASC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    return rows;
  },

  async contarTotal(filtros = {}) {
    const condicoes = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (filtros.perfil) { condicoes.push(`perfil = $${idx++}`); params.push(filtros.perfil); }
    if (filtros.busca) {
      condicoes.push(`(nome ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${filtros.busca}%`); idx++;
    }
    const [rows] = await execute(
      `SELECT COUNT(*) AS total FROM usuarios WHERE ${condicoes.join(' AND ')}`,
      params
    );
    return parseInt(rows[0].total, 10);
  },

  async buscarPorId(id) {
    const [rows] = await execute(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = $1`, [id]
    );
    return rows[0] || null;
  },

  /** Retorna o registro completo (inclui senha_hash) — uso interno do auth. */
  async buscarPorEmailComSenha(email) {
    const [rows] = await execute(
      `SELECT * FROM usuarios WHERE email = $1 AND deleted_at IS NULL`,
      [email.trim().toLowerCase()]
    );
    return rows[0] || null;
  },

  async buscarPorEmail(email) {
    const [rows] = await execute(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE email = $1 AND deleted_at IS NULL`,
      [email.trim().toLowerCase()]
    );
    return rows[0] || null;
  },

  async criar(dados) {
    const [rows] = await execute(
      `INSERT INTO usuarios
         (nome, email, senha_hash, perfil, acesso_configuracoes, acesso_controles,
          ativo, precisa_trocar_senha, criado_por, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW(), NOW())
       RETURNING ${COLUNAS_PUBLICAS}`,
      [
        dados.nome, dados.email.trim().toLowerCase(), dados.senha_hash,
        dados.perfil || 'padrao',
        dados.acesso_configuracoes ?? false,
        dados.acesso_controles ?? false,
        dados.ativo ?? true,
        dados.precisa_trocar_senha ?? false,
        dados.criado_por || null
      ]
    );
    return rows[0];
  },

  async atualizar(id, dados) {
    const [rows] = await execute(
      `UPDATE usuarios SET
         nome = COALESCE($1, nome),
         perfil = COALESCE($2, perfil),
         acesso_configuracoes = COALESCE($3, acesso_configuracoes),
         acesso_controles = COALESCE($4, acesso_controles),
         ativo = COALESCE($5, ativo),
         atualizado_por = $6,
         updated_at = NOW()
       WHERE id = $7 AND deleted_at IS NULL
       RETURNING ${COLUNAS_PUBLICAS}`,
      [
        dados.nome ?? null, dados.perfil ?? null,
        dados.acesso_configuracoes ?? null, dados.acesso_controles ?? null,
        dados.ativo ?? null, dados.atualizado_por || null, id
      ]
    );
    return rows[0] || null;
  },

  async atualizarSenha(id, senhaHash, precisaTrocar = false) {
    await execute(
      `UPDATE usuarios SET senha_hash = $1, precisa_trocar_senha = $2, updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL`,
      [senhaHash, precisaTrocar, id]
    );
  },

  async registrarAcesso(id) {
    await execute(`UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1`, [id]);
  },

  async deletarLogicamente(id, usuarioId) {
    await execute(
      `UPDATE usuarios SET deleted_at = NOW(), deletado_por = $1, ativo = FALSE, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [usuarioId, id]
    );
  },

  /** Conta administradores ativos (para proteger o último admin). */
  async contarAdminsAtivos() {
    const [rows] = await execute(
      `SELECT COUNT(*)::int AS total FROM usuarios
       WHERE perfil = 'administrador' AND ativo = TRUE AND deleted_at IS NULL`
    );
    return rows[0]?.total ?? 0;
  },

  /** Verifica se um usuário está ativo (para invalidação de sessão). */
  async estaAtivo(id) {
    const [rows] = await execute(
      `SELECT 1 FROM usuarios WHERE id = $1 AND ativo = TRUE AND deleted_at IS NULL`,
      [id]
    );
    return rows.length > 0;
  }
};

module.exports = usuariosModel;
