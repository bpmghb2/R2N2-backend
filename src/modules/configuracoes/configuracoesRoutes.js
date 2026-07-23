'use strict';

const { Router } = require('express');
const ConfiguracoesController = require('./configuracoesController');
const autenticacao = require('../../middlewares/autenticacao');
const verificarPermissao = require('../../middlewares/verificarPermissao');
const { validar } = require('../../middlewares/validacao');
const configuracoesValidators = require('./configuracoesValidators');

const router = Router();

/**
 * @swagger
 * /configuracoes:
 *   get:
 *     summary: Obtém as configurações globais
 *     tags: [Configurações]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: Configurações } }
 */
// Leitura liberada a qualquer usuário autenticado (front precisa de logo, prefixos, prazos).
router.get('/', autenticacao, ConfiguracoesController.obter);
router.put('/', autenticacao, verificarPermissao('configuracoes:editar'),
  validar(configuracoesValidators.atualizar), ConfiguracoesController.atualizar);

/**
 * @swagger
 * /configuracoes/api-key:
 *   get:
 *     summary: Retorna a chave de API atual (BearerAuth para a API v1)
 *     tags: [Configurações]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: "{ apiKey }" } }
 *   post:
 *     summary: Gera (rotaciona) uma nova chave de API
 *     tags: [Configurações]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: "Nova chave gerada" } }
 */
router.get('/api-key', autenticacao, verificarPermissao('configuracoes:editar'), ConfiguracoesController.obterApiKey);
router.post('/api-key', autenticacao, verificarPermissao('configuracoes:editar'), ConfiguracoesController.gerarApiKey);

/**
 * @swagger
 * /configuracoes/senha-mestra:
 *   post:
 *     summary: Define/atualiza a senha mestra (confirmação de status sensíveis)
 *     tags: [Configurações]
 *     security: [{ BearerAuth: [] }]
 *     responses: { 200: { description: "Senha mestra definida" } }
 */
router.post('/senha-mestra', autenticacao, verificarPermissao('configuracoes:editar'), ConfiguracoesController.definirSenhaMestra);

module.exports = router;
