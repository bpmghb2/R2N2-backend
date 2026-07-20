// =============================================================
// Rotas do módulo Cotações.
// =============================================================

'use strict';

const { Router } = require('express');
const CotacoesController = require('./cotacoesController');
const autenticacao = require('../../middlewares/autenticacao');
const verificarPermissao = require('../../middlewares/verificarPermissao');
const { validar } = require('../../middlewares/validacao');
const v = require('./cotacoesValidators');

const router = Router();

const podeVer = verificarPermissao('cotacoes:visualizar');
const podeCriar = verificarPermissao('cotacoes:criar');
const podeEditar = verificarPermissao('cotacoes:editar');
const podeAprovar = verificarPermissao('cotacoes:aprovar');
const podeDeletar = verificarPermissao('cotacoes:deletar');

/**
 * @swagger
 * /cotacoes:
 *   get:
 *     summary: Lista cotações
 *     tags: [Cotações]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: Lista } }
 *   post:
 *     summary: Cria uma cotação
 *     tags: [Cotações]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 201: { description: Criada } }
 */
router.get('/', autenticacao, podeVer, CotacoesController.listar);
router.get('/:id', autenticacao, podeVer, CotacoesController.buscarPorId);
router.post('/', autenticacao, podeCriar, validar(v.criar), CotacoesController.criar);
router.put('/:id', autenticacao, podeEditar, validar(v.atualizar), CotacoesController.atualizar);
router.patch('/:id/status', autenticacao, podeEditar, validar(v.alterarStatus), CotacoesController.alterarStatus);
router.post('/:id/aprovar', autenticacao, podeAprovar, validar(v.aprovar), CotacoesController.aprovar);
router.post('/:id/clonar', autenticacao, podeCriar, CotacoesController.clonar);
router.delete('/:id', autenticacao, podeDeletar, CotacoesController.remover);

module.exports = router;
