// =============================================================
// Service de Usuários — regras de negócio.
// =============================================================

'use strict';

const usuariosModel = require('./usuariosModel');
const { hashSenha } = require('../../utils/senha');
const { errNegocio, errNaoEncontrado, errAutorizacao } = require('../../utils/erros');

// Defaults de acesso por perfil (espelha o comportamento do sistema original)
function acessosPorPerfil(perfil) {
  switch (perfil) {
    case 'administrador':
    case 'ti':
    case 'gestor':
    case 'padrao':
      return { acesso_configuracoes: true, acesso_controles: true };
    case 'visitante':
      return { acesso_configuracoes: false, acesso_controles: true };
    case 'cliente':
    default:
      return { acesso_configuracoes: false, acesso_controles: false };
  }
}

const usuariosService = {
  async listar({ pagina, limite, filtros }) {
    const p = Math.max(1, pagina);
    const l = Math.min(100, Math.max(1, limite));
    const offset = (p - 1) * l;
    const [registros, total] = await Promise.all([
      usuariosModel.listar({ limite: l, offset, filtros }),
      usuariosModel.contarTotal(filtros)
    ]);
    return { registros, total };
  },

  buscarPorId(id) {
    return usuariosModel.buscarPorId(id);
  },

  async criar(dados, criadoPor) {
    const existente = await usuariosModel.buscarPorEmail(dados.email);
    if (existente) throw errNegocio(`Já existe um usuário com o e-mail "${dados.email}"`);

    // Se acessos não vierem explicitamente, aplica defaults do perfil
    const defaults = acessosPorPerfil(dados.perfil);

    const senha_hash = await hashSenha(dados.senha);
    return usuariosModel.criar({
      nome: dados.nome.trim(),
      email: dados.email,
      senha_hash,
      perfil: dados.perfil,
      acesso_configuracoes: dados.acesso_configuracoes ?? defaults.acesso_configuracoes,
      acesso_controles: dados.acesso_controles ?? defaults.acesso_controles,
      ativo: dados.ativo ?? true,
      precisa_trocar_senha: dados.precisa_trocar_senha ?? false,
      criado_por: criadoPor
    });
  },

  async atualizar(id, dados, atualizadoPor) {
    const atual = await usuariosModel.buscarPorId(id);
    if (!atual) return null;
    return usuariosModel.atualizar(id, { ...dados, atualizado_por: atualizadoPor });
  },

  async redefinirSenha(id, novaSenha, precisaTrocar = false) {
    const atual = await usuariosModel.buscarPorId(id);
    if (!atual) throw errNegocio('Usuário não encontrado');
    if (novaSenha.length < 6) throw errNegocio('A senha deve ter ao menos 6 caracteres');
    const hash = await hashSenha(novaSenha);
    await usuariosModel.atualizarSenha(id, hash, precisaTrocar);
  },

  async remover(id, usuarioId) {
    // Mesmas regras de integridade da inativação (RNF-USR-006).
    return this.inativar(id, usuarioId);
  },

  /**
   * Inativa (soft delete) um usuário aplicando as regras de integridade RNF-USR-006:
   * - 404 se não existir ou já estiver inativo (idempotência).
   * - 403 se for auto-inativação.
   * - 403 se for o último administrador ativo.
   * Retorna os dados anteriores para a auditoria.
   */
  async inativar(id, executorId) {
    const alvo = await usuariosModel.buscarPorId(id);
    if (!alvo || alvo.deleted_at) throw errNaoEncontrado('Usuário não encontrado');
    if (!alvo.ativo) throw errNaoEncontrado('Usuário já está inativo');

    if (id === executorId) throw errAutorizacao('Você não pode inativar o próprio usuário');

    if (alvo.perfil === 'administrador') {
      const admins = await usuariosModel.contarAdminsAtivos();
      if (admins <= 1) throw errAutorizacao('Não é possível inativar o último administrador ativo');
    }

    await usuariosModel.deletarLogicamente(id, executorId);
    return { antes: { ativo: true }, depois: { ativo: false }, alvo };
  }
};

module.exports = { usuariosService, acessosPorPerfil };
