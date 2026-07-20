// =============================================================
// Rotas do módulo Usuários.
// Registrar em app.js: app.use('/api/usuarios', usuariosRoutes)
// =============================================================

'use strict';

const { Router } = require('express');
const UsuariosController = require('./usuariosController');
const autenticacao = require('../../middlewares/autenticacao');
const verificarPermissao = require('../../middlewares/verificarPermissao');
const { validar } = require('../../middlewares/validacao');
const usuariosValidators = require('./usuariosValidators');

const router = Router();

// Gestão de usuários é parte de Configurações (acesso administrativo)
const podeVisualizar = verificarPermissao('configuracoes:visualizar');
const podeEditar = verificarPermissao('configuracoes:editar');

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Lista usuários
 *     tags: [Usuários]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de usuários }
 */
router.get('/', autenticacao, podeVisualizar, UsuariosController.listar);
router.get('/:id', autenticacao, podeVisualizar, UsuariosController.buscarPorId);
router.post('/', autenticacao, podeEditar, validar(usuariosValidators.criar), UsuariosController.criar);
router.put('/:id', autenticacao, podeEditar, validar(usuariosValidators.atualizar), UsuariosController.atualizar);
router.patch('/:id/senha', autenticacao, podeEditar, validar(usuariosValidators.redefinirSenha), UsuariosController.redefinirSenha);
router.delete('/:id', autenticacao, podeEditar, UsuariosController.remover);

module.exports = router;
