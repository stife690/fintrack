# FinTrack — Backend

API REST de FinTrack: autenticación, gestión de gastos y sincronización con el cliente offline-first.

> **Estado:** en construcción (Sprint 1). Ya incluye la conexión a PostgreSQL, `GET /health` con verificación de la base de datos, CORS y el manejo central de errores.

## Stack

- **Node.js** 22 (ES Modules)
- **Express 5**
- **PostgreSQL 17** con el driver [`pg`](https://node-postgres.com/) (pool de conexiones)
- **Docker** para la base de datos en desarrollo local

## Estructura

Arquitectura por capas. Cada petición recorre:

```
routes → controllers → services → repositories → PostgreSQL
```

```
backend/
├── src/
│   ├── routes/        → define las URLs y qué controller atiende cada una
│   ├── controllers/   → lee la petición (req) y arma la respuesta (res, código HTTP)
│   ├── services/      → lógica de negocio (no conoce req/res)
│   ├── repositories/  → consultas SQL; única capa que usa el pool de PostgreSQL
│   ├── middlewares/   → 404, manejo central de errores, autenticación, etc.
│   ├── errors/        → AppError: errores esperados con su código del contrato
│   ├── config/
│   │   ├── env.js     → única lectura de process.env
│   │   └── db.js      → pool de conexiones a PostgreSQL
│   ├── app.js         → configura Express (middlewares y rutas)
│   └── server.js      → arranca el servidor HTTP
├── .env.example       → plantilla de variables de entorno (sin secretos)
├── package.json
└── README.md
```

Reglas:

- Los controllers **no** escriben SQL. Siempre pasan por un service, y el service por un repository.
- Ningún módulo lee `process.env` directamente: todo pasa por `config/env.js`.

## Levantar en local

### Requisitos

- [Node.js](https://nodejs.org/) 22 o superior (`node -v`)
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) encendido (`docker info` debe responder)

> En Windows, los comandos de esta guía están pensados para **Git Bash**.

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

3. Levantar PostgreSQL en Docker (solo la primera vez):

   ```bash
   MSYS_NO_PATHCONV=1 docker run --name fintrack-db -e POSTGRES_USER=fintrack -e POSTGRES_PASSWORD=fintrack_dev -e POSTGRES_DB=fintrack -p 5434:5432 -v fintrack-pgdata:/var/lib/postgresql/data -d postgres:17
   ```

   - Usa el puerto **5434** del host para no chocar con instalaciones locales de PostgreSQL (que suelen ocupar 5432 y 5433).
   - `MSYS_NO_PATHCONV=1` solo hace falta en Git Bash (evita que traduzca la ruta interna del contenedor). En macOS/Linux se puede omitir.
   - Las credenciales son **solo de desarrollo local**.
   - Las siguientes veces basta con: `docker start fintrack-db`

4. Crear el archivo de variables de entorno a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

   El `.env` **nunca se sube** al repositorio (está en `.gitignore`).

5. Iniciar en modo desarrollo (carga `.env` y se reinicia solo al guardar cambios):

   ```bash
   npm run dev
   ```

6. Verificar desde otra terminal:

   ```bash
   curl http://localhost:3000/health
   ```

   Debe responder `"status":"ok"` y `"database":"up"`.

## Variables de entorno

| Variable | Obligatoria | Ejemplo | Descripción |
|---|---|---|---|
| `DATABASE_URL` | Sí | `postgresql://fintrack:fintrack_dev@localhost:5434/fintrack` | Cadena de conexión a PostgreSQL. En producción la entrega el proveedor (Render, Neon, Supabase). |
| `DB_POOL_MAX` | No | `10` | Máximo de conexiones simultáneas del pool. En producción debe quedar por debajo del límite de conexiones del plan de la BD. Por defecto 10. |
| `PORT` | No | `3000` | Puerto HTTP. Render lo define automáticamente. |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Origen(es) permitidos del frontend, separados por coma y sin barra final. Vacío = cualquier origen (solo desarrollo). |
| `NODE_ENV` | No | `production` | Entorno de ejecución. Por defecto `development`. |

En producción no hay archivo `.env`: las variables se configuran en el panel del proveedor (Render → *Environment*).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor cargando `.env`, con recarga automática (`node --watch`). |
| `npm start` | Inicia el servidor en modo normal (el que usa producción; no lee `.env`). |
| `npm test` | Ejecuta las pruebas (`node --test`). Carga `.env` si existe. Las de `/health` necesitan la base de datos encendida. |

## Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio y de la base de datos. **200** `{ status: "ok", database: "up", ... }` o **503** `{ status: "error", database: "down", ... }` si PostgreSQL no responde. Lo usan Render (health check) y el smoke test. |

## Manejo de errores

Todo error termina en el middleware central (`middlewares/error.middleware.js`) y se responde con el formato único del contrato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "texto legible", "details": [{ "field": "amount", "problem": "Debe ser un número mayor que 0" }] } }
```

| Situación | HTTP | `code` |
|---|---|---|
| Ruta inexistente | 404 | `NOT_FOUND` |
| Body con JSON mal formado | 400 | `VALIDATION_ERROR` |
| Error esperado de negocio (`throw new AppError(...)`) | El del `AppError` | El del `AppError` |
| Error inesperado | 500 | `INTERNAL_ERROR` (sin detalles internos; el detalle queda en el log) |

Para lanzar un error esperado desde un service o controller:

```js
import { AppError } from '../errors/app-error.js';

throw new AppError(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
```

## Convenciones de la API

- JSON sobre HTTPS (REST). Las rutas de negocio vivirán bajo `/api/v1`; `/health` queda en la raíz.
- Autenticación con `Authorization: Bearer <token>` en todos los endpoints salvo registro, login, refresh y health.
- Paginación: `?page=` y `?pageSize=` → `{ data, page, pageSize, total }`.
- Fechas de dominio en `YYYY-MM-DD`; timestamps del sistema en ISO 8601 UTC.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `/health` responde 503 / `ECONNREFUSED` | El contenedor está apagado | `docker start fintrack-db` |
| `password authentication failed` (a veces en español) | Te estás conectando a un PostgreSQL instalado en el sistema, no al contenedor | Revisa que `DATABASE_URL` use el puerto **5434** y que ese puerto no lo use otro programa (`netstat -ano \| grep 5434`) |
| `Cannot find module` al correr `npm run dev` | Estás en otra carpeta | Ejecuta los comandos desde `fintrack/backend` |
| `docker: Conflict. The container name "/fintrack-db" is already in use` | El contenedor ya existe | Usa `docker start fintrack-db` en vez de `docker run` |

## Próximamente

- [x] Variables de entorno (`.env` / `.env.example`)
- [x] Conexión a PostgreSQL (Docker en local)
- [x] `GET /health` con verificación de la base de datos
- [x] Middleware central de errores
- [x] CORS para el frontend (variable `CORS_ORIGIN`)
- [ ] `docker-compose` para levantar PostgreSQL y backend con un comando
- [ ] Registro y login con JWT (`/api/v1/auth/...`)
- [ ] Documentación Swagger del contrato
