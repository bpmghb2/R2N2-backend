'use strict';

const { Router } = require('express');
const ControlesController = require('./controlesController');
const autenticacao = require('../../middlewares/autenticacao');
const verificarPermissao = require('../../middlewares/verificarPermissao');
const { validar } = require('../../middlewares/validacao');
const v = require('./controlesValidators');

const router = Router();

const podeVer = verificarPermissao('controles:visualizar');
const podeCriar = verificarPermissao('controles:criar');
const podeEditar = verificarPermissao('controles:editar');
const podeDeletar = verificarPermissao('controles:deletar');

/**
 * @swagger
 * /controles:
 *   get:
 *     summary: Lista controles/demandas
 *     tags: [Controles]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: Lista } }
 */
router.get('/', autenticacao, podeVer, ControlesController.listar);
router.get('/:id', autenticacao, podeVer, ControlesController.buscarPorId);
router.post('/', autenticacao, podeCriar, validar(v.criar), ControlesController.criar);
router.put('/:id', autenticacao, podeEditar, validar(v.atualizar), ControlesController.atualizar);
router.patch('/:id/status', autenticacao, podeEditar, validar(v.alterarStatus), ControlesController.alterarStatus);
router.delete('/:id', autenticacao, podeDeletar, ControlesController.remover);

module.exports = router;
