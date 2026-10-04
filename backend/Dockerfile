# Imagen del backend de FinTrack (desarrollo local con docker compose).
FROM node:20-alpine

WORKDIR /app

# Primero las dependencias, para aprovechar la caché de capas de Docker.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

# Ejecutar como usuario sin privilegios.
USER node

CMD ["node", "src/server.js"]
