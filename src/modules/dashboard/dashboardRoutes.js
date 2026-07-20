'use strict';

const { Router } = require('express');
const DashboardController = require('./dashboardController');
const autenticacao = require('../../middlewares/autenticacao');

const router = Router();

/**
 * @swagger
 * /dashboard/resumo:
 *   get:
 *     summary: Resumo/contadores do sistema
 *     tags: [Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: Resumo } }
 */
router.get('/resumo', autenticacao, DashboardController.resumo);

/**
 * @swagger
 * /dashboard/notificacoes:
 *   get:
 *     summary: Contagem de itens vencidos/vencendo hoje (badge do app)
 *     tags: [Dashboard]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: "{ count }" } }
 */
router.get('/notificacoes', autenticacao, DashboardController.notificacoes);

module.exports = router;
