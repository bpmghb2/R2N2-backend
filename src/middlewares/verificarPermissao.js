// =============================================================
// Middleware de autorização (RBAC).
// Factory: verificarPermissao('cotacoes:criar')
//
// Modelo de permissões do R2DN (derivado do sistema original):
//   perfil 'administrador' / 'ti'  → acesso irrestrito
//   perfil 'gestor' / 'padrao'     → acesso operacional completo (edição)
//   perfil 'visitante'             → apenas leitura (:visualizar)
//   perfil 'cliente'               → apenas pendências/consulta restrita
//
// Além do perfil, dois flags controlam áreas específicas:
//   acesso_configuracoes → módulo Configurações
//   acesso_controles     → módulo Controles/Demandas
// =============================================================

'use strict';

const { createLogger } = require('../utils/logger');
const logger = createLogger('Permissao');

// Perfis com acesso total ao sistema.
const PERFIS_ADMIN = ['administrador', 'ti'];
// Perfis que podem editar (criar/editar/aprovar/remover).
const PERFIS_EDICAO = ['administrador', 'ti', 'gestor', 'padrao'];

function verificarPermissao(codigoPermissao) {
  const [modulo, acao] = codigoPermissao.split(':');

  return function (req, res, next) {
    try {
      const { perfil, acessoConfiguracoes, acessoControles } = req.usuario;

      // 1) Acesso total
      if (PERFIS_ADMIN.includes(perfil)) return next();

      // 2) Flags de área específica (bloqueiam módulos inteiros)
      if (modulo === 'configuracoes' && !acessoConfiguracoes) {
        return negar(res, req, codigoPermissao);
      }
      if (modulo === 'controles' && !acessoControles) {
        return negar(res, req, codigoPermissao);
      }

      // 3) Leitura é permitida a todos os perfis autenticados
      if (acao === 'visualizar') return next();

      // 4) Escrita exige perfil de edição
      if (PERFIS_EDICAO.includes(perfil)) return next();

      return negar(res, req, codigoPermissao);
    } catch (error) {
      logger.error('Erro na verificação de permissão', { erro: error.message });
      return res.status(500).json({ success: false, message: 'Erro ao verificar permissões' });
    }
  };
}

function negar(res, req, codigoPermissao) {
  logger.warn('Acesso negado por permissão', {
    usuarioId: req.usuario?.id,
    perfil: req.usuario?.perfil,
    permissaoRequerida: codigoPermissao,
    rota: req.path
  });
  return res.status(403).json({
    success: false,
    message: 'Você não tem permissão para realizar esta ação.'
  });
}

module.exports = verificarPermissao;
