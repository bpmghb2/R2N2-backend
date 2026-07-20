// =============================================================
// PM2 — configuração de processos do projeto R2DN.
// Uso:
//   pm2 start ecosystem.config.js --env production
//   pm2 start ecosystem.config.js --only r2dn-backend
// =============================================================
module.exports = {
  apps: [
    {
      name: 'r2dn-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,          // usar 'max' + exec_mode 'cluster' em produção conforme carga
      exec_mode: 'fork',
      env: { NODE_ENV: 'development', PORT: 3002 },
      env_production: { NODE_ENV: 'production', PORT: 3002 },
      max_memory_restart: '400M',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'r2dn-frontend',
      // Executa o build de produção do Next.js (npm run start -> next start -p 3000).
      // Rode `npm run build` na pasta frontend antes de iniciar este processo.
      script: 'npm',
      args: 'run start',
      cwd: `${__dirname}/../frontend`,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'development', PORT: 3000 },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        BACKEND_URL: 'http://localhost:3002'
      },
      max_memory_restart: '500M',
      out_file: 'logs/frontend-out.log',
      error_file: 'logs/frontend-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
