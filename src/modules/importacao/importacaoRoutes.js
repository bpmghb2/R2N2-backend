'use strict';

const { Router } = require('express');
const ImportacaoController = require('./importacaoController');
const autenticacao = require('../../middlewares/autenticacao');
const verificarPermissao = require('../../middlewares/verificarPermissao');

const router = Router();

/**
 * @swagger
 * /importacao:
 *   post:
 *     summary: Importa um backup JSON (Firebase) para o banco R2DN (idempotente)
 *     tags: [Importação]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Relatório da importação }
 *       400: { description: JSON inválido }
 *       403: { description: Sem permissão }
 */
router.post('/', autenticacao, verificarPermissao('configuracoes:editar'), ImportacaoController.importar);

module.exports = router;
