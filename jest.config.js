// =============================================================
// Configuração do Jest — R2DN backend
// Política de testes (Roadmap §7 — Definition of Done, Opção B):
//   - Cada componente tem seu teste co-localizado (<arquivo>.test.js).
//   - Toda alteração de componente ajusta o teste correspondente.
//   - CI roda `npm test`; o gate de cobertura bloqueia regressões.
//
// ROLLOUT: enquanto ainda não há testes, mantemos passWithNoTests=true e os
// thresholds desativados para NÃO quebrar o CI. Assim que os primeiros
// componentes forem cobertos, descomentar coverageThreshold (subindo gradual-
// mente ~60/70%) e trocar passWithNoTests para false.
// =============================================================

'use strict';

module.exports = {
  testEnvironment: 'node',

  // Testes co-localizados: <componente>.test.js ao lado do componente
  testMatch: ['**/*.test.js', '**/*.spec.js'],

  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/swagger.js'
  ],
  coverageReporters: ['text-summary', 'lcov'],

  // Ativar quando os primeiros testes existirem (ver ROLLOUT acima):
  // coverageThreshold: {
  //   global: { branches: 60, functions: 70, lines: 70, statements: 70 }
  // },

  passWithNoTests: false, // já existem testes co-localizados

  clearMocks: true,
  verbose: true
};
