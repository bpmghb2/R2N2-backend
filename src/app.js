// =============================================================
// Configuração do aplicativo Express (sem iniciar o servidor).
// Separado de server.js para facilitar testes com supertest.
// =============================================================

'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// Rotas dos módulos
const authRoutes          = require('./modules/auth/authRoutes');
const usuariosRoutes      = require('./modules/usuarios/usuariosRoutes');
const cotacoesRoutes      = require('./modules/cotacoes/cotacoesRoutes');
const controlesRoutes     = require('./modules/controles/controlesRoutes');
const configuracoesRoutes = require('./modules/configuracoes/configuracoesRoutes');
const dashboardRoutes     = require('./modules/dashboard/dashboardRoutes');
const importacaoRoutes    = require('./modules/importacao/importacaoRoutes');
const v1Routes            = require('./routes/v1');

const app = express();

// Segurança e infraestrutura
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limit específico para login (proteção contra força bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});
app.use('/api/auth/login', loginLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'R2DN API online', timestamp: new Date().toISOString() });
});

// Documentação — UI interativa + spec exportável (RNF-USR-002)
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Módulos de negócio
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/cotacoes', cotacoesRoutes);
app.use('/api/controles', controlesRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/importacao', importacaoRoutes);

// API v1 — contrato externo (consumo por outras plataformas)
app.use('/api/v1', v1Routes);

// 404 e tratamento global de erros (sempre por último)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
