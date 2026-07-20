# R2DN — Backend

API do sistema de Gerenciamento de Cotações/Compras da RN Gerenciadora, aderente ao
Framework Corporativo BPM (Node.js 18 + Express, MVC, PostgreSQL com SQL direto, JWT + RBAC).

## Requisitos
- Node.js 18+
- PostgreSQL acessível (banco `R2DN` em `192.168.0.40:5432`)

## Configuração
```bash
cd backend
cp .env.example .env       # preencha DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_SENHA
npm install
```
Gerar segredos JWT:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Banco de dados
```bash
# 1) Criar o banco (uma vez, no servidor Postgres):
#    CREATE DATABASE "R2DN";
npm run migrate        # cria todas as tabelas (idempotente)
npm run seed:admin     # cria o administrador (usa ADMIN_EMAIL / ADMIN_SENHA do .env)
```

## Executar
```bash
npm run dev            # desenvolvimento (watch)
npm start              # produção
# PM2:
pm2 start ecosystem.config.js --env production
```
- API: `http://localhost:3002/api`
- Health: `GET /api/health`
- Swagger: `http://localhost:3002/api/docs`

## Testar (fluxo mínimo)
```bash
# Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"financeiro@rngerenciadora.com.br","senha":"SUA_SENHA"}'

# Usar o accessToken retornado:
curl http://localhost:3002/api/cotacoes -H "Authorization: Bearer <TOKEN>"
```

## Importar dados do Firebase (backup JSON)
```bash
# Coloque o backup e ajuste IMPORT_JSON_PATH no .env, ou passe o caminho direto:
npm run import:json
# ou
node scripts/import-firebase-json.js /caminho/backup_firebase_completo_2026-07-17.json
```
O script corrige o encoding (mojibake), migra configurações, usuários (senha temporária
`IMPORT_DEFAULT_PASSWORD` com troca obrigatória), cotações e controles. É idempotente.

## Estrutura
```
src/
├── config/        database.js, swagger.js
├── middlewares/   autenticacao, verificarPermissao, validacao, errorHandler
├── utils/         logger, jwt, senha, erros, prazo
├── services/      auditService
├── modules/       auth, usuarios, cotacoes, controles, configuracoes, dashboard
│   └── <mod>/     <mod>Routes.js, Controller.js, Service.js, Model.js, Validators.js
├── sql/migrations/  001..005 .sql
├── app.js  server.js
scripts/           run-migrations.js, seed-admin.js, import-firebase-json.js
```

## Endpoints principais
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Autentica (retorna JWT) |
| GET | `/api/auth/me` | Usuário logado |
| POST | `/api/auth/refresh` | Renova token |
| GET/POST/PUT/PATCH/DELETE | `/api/usuarios` | Gestão de usuários |
| GET/POST/PUT/DELETE | `/api/cotacoes` | Cotações (+ `/:id/status`, `/:id/aprovar`, `/:id/clonar`) |
| GET/POST/PUT/DELETE | `/api/controles` | Controles/demandas (+ `/:id/status`) |
| GET/PUT | `/api/configuracoes` | Configurações globais |
| GET | `/api/dashboard/resumo` | Contadores |
