# FinTrack — Backend

API REST de FinTrack: autenticación, gestión de gastos y sincronización con el cliente offline-first.

> **Estado:** en construcción (Sprint 1). Esta guía se actualiza a medida que se agregan la base de datos, las variables de entorno y el endpoint `GET /health`.

## Stack

- **Node.js** ≥ 20 (ES Modules)
- **Express 5**
- **PostgreSQL** con el driver `pg` *(próximamente)*

## Estructura

Arquitectura por capas. Cada petición recorre:

```
routes → controllers → services → repositories → PostgreSQL
```

```
backend/
├── src/
│   ├── routes/        → define las URLs y qué controller atiende cada una
│   ├── controllers/   → lee la petición (req) y arma la respuesta (res)
│   ├── services/      → lógica de negocio
│   ├── repositories/  → consultas SQL a PostgreSQL
│   ├── middlewares/   → manejo de errores, autenticación, etc.
│   ├── config/        → conexión a la BD y variables de entorno
│   ├── app.js         → configura Express (middlewares y rutas)
│   └── server.js      → arranca el servidor HTTP
├── package.json
└── README.md
```

Regla: los controllers **no** escriben SQL. Siempre pasan por un service, y el service por un repository.

## Levantar en local

### Requisitos

- [Node.js](https://nodejs.org/) 20 o superior (`node -v`)
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL en local)

### Pasos

1. Clonar el repositorio y entrar al backend:

   ```bash
   git clone https://github.com/stife690/fintrack.git
   cd fintrack/backend
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Levantar PostgreSQL con Docker (desde la **raíz** del repositorio, no desde `backend/`):

   ```bash
   cd ..
   docker compose up -d db
   cd backend
   ```

   La primera vez crea las 8 tablas del Modelo Relacional v2.0 y carga el catálogo de 15 categorías
   (`db/init/`). Copiar `backend/.env.example` a `backend/.env` para usar la misma conexión.

4. Iniciar en modo desarrollo (se reinicia solo al guardar cambios):

   ```bash
   npm run dev
   ```

5. Probar <http://localhost:3000/health>.

### Todo en contenedores (opcional)

```bash
docker compose up --build    # PostgreSQL + backend en http://localhost:3000
docker compose down          # apaga (conserva los datos)
docker compose down -v       # apaga y borra los datos; el esquema se recrea al volver a levantar
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor con `node --watch` (recarga automática). |
| `npm start` | Inicia el servidor en modo normal (el que usa producción). |
| `npm test` | Corre las pruebas (`node --test`). Es lo que ejecuta el CI. |

## Convenciones de la API

- JSON sobre HTTPS (REST).
- Autenticación con `Authorization: Bearer <token>` en todos los endpoints salvo registro y login.
- Formato único de errores:

  ```json
  { "error": { "code": "STRING", "message": "texto legible" } }
  ```

- Paginación: `?page=` y `?pageSize=` → `{ data, page, pageSize, total }`.
- Fechas en ISO 8601 (`YYYY-MM-DD`).

## Próximamente

- [ ] Variables de entorno (`.env` / `.env.example`)
- [x] PostgreSQL en local con Docker (`docker compose up -d db`, esquema en `db/init/`)
- [ ] Conexión del backend a PostgreSQL con `pg` (usa `DATABASE_URL`)
- [x] `GET /health` (falta agregar la verificación de la base de datos)
- [ ] Middleware central de errores
- [x] CORS para el frontend (variable `CORS_ORIGIN`, ver `.env.example`)
