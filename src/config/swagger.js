// =============================================================
// Configuração do Swagger / OpenAPI 3.
// Documentação servida em /api/docs.
// =============================================================

'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API R2DN — Gerenciamento de Cotações (RN Gerenciadora)',
      version: '0.1.0',
      description: 'API backend do sistema R2DN, aderente ao Framework Corporativo BPM.'
    },
    servers: [{ url: '/api', description: 'Base da API' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Informe no botão Authorize a CHAVE DE API gerada em Configurações → Integração ' +
            '(prefixo r2dn_...). É a única forma de autenticar a API v1. ' +
            'Enviada como header: Authorization: Bearer <chave>.'
        }
      }
    }
  },
  // Anotações JSDoc @swagger nos arquivos de rotas (módulos + API v1 externa)
  apis: ['./src/modules/**/*Routes.js', './src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
