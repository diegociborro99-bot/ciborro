# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────
# 1. Compila el escritorio
# ─────────────────────────────────────────────────────────────────────
FROM node:22-slim AS web
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────
# 2. Dependencias del servidor (sin las de desarrollo)
#    En capa aparte para que un cambio de código no reinstale sharp.
# ─────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app/backend

COPY backend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ─────────────────────────────────────────────────────────────────────
# 3. Imagen final: un servicio que sirve la API y la web
# ─────────────────────────────────────────────────────────────────────
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app/backend

COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
# el servidor busca la web en ../public respecto de src/
COPY --from=web /app/frontend/dist ./public

# Sin R2, las fotos van a este directorio y las escribe el proceso, que corre
# como `node`. Los COPY de arriba dejan todo en manos de root, así que hay que
# crearlo aquí con su dueño: si no, el arranque muere con EACCES.
RUN mkdir -p data/fotos && chown -R node:node data

USER node
EXPOSE 3000

# comprobación de vida: Railway reinicia el contenedor si deja de responder
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
