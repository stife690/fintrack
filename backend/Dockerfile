# Imagen del backend de FinTrack (Node 20, Express 5).
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Primero solo los manifests, para aprovechar la caché de capas de Docker.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# Usuario sin privilegios (la imagen ya trae el usuario "node").
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
