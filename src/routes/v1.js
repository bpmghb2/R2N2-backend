// =============================================================
// API v1 — contrato estável para consumo EXTERNO (outras plataformas).
// Conforme 00-PROJETO/03-rnf-modulo-usuarios-api-segura.md (framework BPM).
//
// Autenticação: SOMENTE a CHAVE DE API (gerada em Configurações → Integração),
// enviada em Authorization: Bearer <chave>. Não há login/JWT nesta API.
//
// Fluxo do consumidor:
//   GET   /api/v1/usuarios              (Authorization: Bearer <chave>)
//   PATCH /api/v1/usuarios/:id/inativar (Authorization: Bearer <chave>)
//
// Auditoria de 401/403 e da inativação (RNF-USR-004). Respostas padrão BPM.
// =============================================================

'use strict';

const { Router } = require('express');
const UsuariosController = require('../modules/usuarios/usuariosController');
const autenticacao = require('../middlewares/autenticacaoIntegracao');
const somenteAdmin = require('../middlewares/somenteAdmin');

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: v1 - Usuários
 */

/**
 * @swagger
 * /v1/usuarios:
 *   get:
 *     summary: Lista usuários (paginado)
 *     description: "Requer perfil administrador/ti (permissão administracao:usuarios:visualizar). Nunca retorna senha_hash."
 *     tags: [v1 - Usuários]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: pagina, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limite, schema: { type: integer, maximum: 100, default: 50 } }
 *       - { in: query, name: busca, schema: { type: string } }
 *       - { in: query, name: perfil, schema: { type: string } }
 *     responses:
 *       200: { description: "Lista de usuários (formato { success, data, total })" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Sem permissão" }
 *       500: { description: "Erro interno" }
 */
router.get(
  '/usuarios',
  autenticacao,
  somenteAdmin('administracao:usuarios:visualizar'),
  UsuariosController.listar
);

/**
 * @swagger
 * /v1/usuarios/{id}/inativar:
 *   patch:
 *     summary: Inativa (soft delete) um usuário
 *     description: >
 *       Requer perfil administrador/ti (permissão administracao:usuarios:inativar).
 *       Regras: auto-inativação → 403; último administrador → 403; usuário já inativo → 404.
 *     tags: [v1 - Usuários]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo: { type: string }
 *     responses:
 *       200: { description: "Usuário inativado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Auto-inativação ou último administrador" }
 *       404: { description: "Usuário não encontrado ou já inativo" }
 */
router.patch(
  '/usuarios/:id/inativar',
  autenticacao,
  somenteAdmin('administracao:usuarios:inativar'),
  UsuariosController.inativar
);

module.exports = router;
