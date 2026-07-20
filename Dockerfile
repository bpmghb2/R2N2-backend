# =============================================================
# R2DN — Backend (Node + Express)
# Imagem de produção enxuta.
# =============================================================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# Instala apenas dependências de produção usando o lockfile.
COPY package*.json ./
RUN npm ci --omit=dev

# Código da aplicação e scripts utilitários (migrations, seed, import).
COPY src ./src
COPY scripts ./scripts

EXPOSE 3002

CMD ["node", "src/server.js"]
