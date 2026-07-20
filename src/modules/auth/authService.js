// =============================================================
// Service de Autenticação — regras de login e emissão de tokens.
// =============================================================

'use strict';

const usuariosModel = require('../usuarios/usuariosModel');
const { verificarSenha, hashSenha } = require('../../utils/senha');
const { gerarTokens, verificarRefreshToken } = require('../../utils/jwt');
const { errNegocio } = require('../../utils/erros');

// Erro específico de credenciais inválidas (mapeado para 401 no controller)
const errCredenciais = () =>
  Object.assign(new Error('Credenciais inválidas. Verifique e-mail e senha.'), { tipo: 'CREDENCIAIS' });

const authService = {
  /**
   * Autentica um usuário. Aceita "usuário sem @" (mapeado para @system.local),
   * preservando compatibilidade com as contas legadas do sistema original.
   */
  async login(emailBruto, senha) {
    let email = String(emailBruto || '').trim().toLowerCase();
    if (email && !email.includes('@')) {
      email = `${email}@system.local`;
    }

    const usuario = await usuariosModel.buscarPorEmailComSenha(email);
    if (!usuario) throw errCredenciais();
    if (!usuario.ativo) throw errNegocio('Usuário inativo. Contate o administrador.');

    const senhaOk = await verificarSenha(String(senha || '').trim(), usuario.senha_hash);
    if (!senhaOk) throw errCredenciais();

    await usuariosModel.registrarAcesso(usuario.id);

    const tokens = gerarTokens(usuario);
    return { usuario: this._publico(usuario), ...tokens };
  },

  async renovar(refreshToken) {
    const dados = verificarRefreshToken(refreshToken);
    if (!dados) throw Object.assign(new Error('Refresh token inválido'), { tipo: 'CREDENCIAIS' });

    const usuario = await usuariosModel.buscarPorId(dados.id);
    if (!usuario || !usuario.ativo) throw Object.assign(new Error('Usuário indisponível'), { tipo: 'CREDENCIAIS' });

    const tokens = gerarTokens(usuario);
    return { usuario, ...tokens };
  },

  /** Retorna os dados atualizados do usuário logado (reflete mudanças de permissão). */
  async me(usuarioId) {
    return usuariosModel.buscarPorId(usuarioId);
  },

  /**
   * Troca de senha self-service (usuário autenticado troca a própria senha).
   * Usado no fluxo de primeiro acesso (precisa_trocar_senha=true).
   */
  async trocarSenha(usuarioLogado, senhaAtual, novaSenha) {
    const nova = String(novaSenha || '').trim();
    if (nova.length < 6) throw errNegocio('A nova senha deve ter ao menos 6 caracteres.');

    const usuario = await usuariosModel.buscarPorEmailComSenha(usuarioLogado.email);
    if (!usuario) throw errNegocio('Usuário não encontrado.');

    const atualOk = await verificarSenha(String(senhaAtual || '').trim(), usuario.senha_hash);
    if (!atualOk) throw errNegocio('Senha atual incorreta.');

    const hash = await hashSenha(nova);
    await usuariosModel.atualizarSenha(usuario.id, hash, false);
    return { success: true };
  },

  _publico(u) {
    return {
      id: u.id, nome: u.nome, email: u.email, perfil: u.perfil,
      acesso_configuracoes: u.acesso_configuracoes,
      acesso_controles: u.acesso_controles,
      precisa_trocar_senha: u.precisa_trocar_senha
    };
  }
};

module.exports = authService;
