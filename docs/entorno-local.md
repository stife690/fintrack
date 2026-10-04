# Entorno local con Docker

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) y Node.js 20+.

## Solo la base de datos (recomendado para desarrollar)

```bash
docker compose up -d db
cd backend
cp .env.example .env     # DATABASE_URL ya apunta a localhost:5434
npm install
npm run dev
```

## Base de datos + backend en contenedores

```bash
docker compose up --build
```

- API: http://localhost:3000/health
- PostgreSQL: `localhost:5434` (usuario `fintrack`, contraseña `fintrack_dev`, base `fintrack`)

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `docker compose ps` | Ver el estado de los servicios |
| `docker compose logs -f backend` | Ver los logs del backend |
| `docker compose down` | Apagar conservando los datos |
| `docker compose down -v` | Apagar **y borrar** los datos de la BD |

> Las credenciales de este archivo son solo para desarrollo local. Nunca se usan en producción.
