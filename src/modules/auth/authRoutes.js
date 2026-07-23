// =============================================================
// Rotas do módulo Autenticação.
// Registrar em app.js: app.use('/api/auth', authRoutes)
// =============================================================

'use strict';

const { Router } = require('express');
const AuthController = require('./authController');
const autenticacao = require('../../middlewares/autenticacao');
const { validar } = require('../../middlewares/validacao');
const authValidators = require('./authValidators');

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Autentica um usuário e retorna tokens JWT
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               senha: { type: string }
 *     responses:
 *       200: { description: Autenticado }
 *       401: { description: Credenciais inválidas }
 */
router.post('/login', validar(authValidators.login), AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', autenticacao, AuthController.me);
router.post('/logout', autenticacao, AuthController.logout);
router.post('/trocar-senha', autenticacao, AuthController.trocarSenha);
router.post('/verificar-senha-mestra', autenticacao, AuthController.verificarSenhaMestra);

module.exports = router;
