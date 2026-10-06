# FinTrack — Backend

API REST de FinTrack: autenticación, gestión de gastos y sincronización con el cliente offline-first.

> **Estado:** en construcción (Sprint 1). Ya incluye la conexión a PostgreSQL, `GET /health` con verificación de la base de datos, CORS, el manejo central de errores y la autenticación con JWT (registro, login, refresh, logout y perfil).

## Stack

- **Node.js** 20 o superior (ES Modules)
- **Express 5**
- **PostgreSQL 16** con el driver [`pg`](https://node-postgres.com/) (pool de conexiones)
- **bcryptjs** (hash de contraseñas), **jsonwebtoken** (JWT) y **express-rate-limit** (límite de intentos)
- **Docker Compose** para la base de datos en desarrollo local

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
│   ├── middlewares/   → 404, manejo central de errores, autenticación y límite de intentos
│   ├── validators/    → revisan la forma y las reglas de lo que llega (400 / 422)
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

- [Node.js](https://nodejs.org/) 20 o superior (`node -v`)
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

3. Levantar PostgreSQL con Docker Compose, **desde la raíz del repositorio** (donde está `docker-compose.yml`):

   ```bash
   cd ..
   docker compose up -d db
   cd backend
   ```

   - La primera vez crea las 8 tablas y el catálogo de categorías a partir de `db/init/`.
   - Queda en el puerto **5434** del host, para no chocar con un PostgreSQL instalado en el sistema.
   - Las siguientes veces basta con `docker start fintrack-db`. Más detalles en [docs/entorno-local.md](../docs/entorno-local.md).

4. Crear el archivo de variables de entorno a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

   El `.env` **nunca se sube** al repositorio (está en `.gitignore`). Cambia `JWT_SECRET` por un valor propio:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

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
| `JWT_SECRET` | **Sí en producción** | *(texto largo y aleatorio)* | Secreto que firma los access tokens. Sin él el servidor no arranca en producción; en local hay un valor por defecto solo para desarrollo. |
| `ACCESS_TOKEN_TTL` | No | `15m` | Duración del access token. |
| `REFRESH_TOKEN_TTL_DAYS` | No | `30` | Días de vida del refresh token. |
| `AUTH_RATE_LIMIT_MAX` | No | `20` | Intentos de login/registro permitidos por IP cada 15 minutos. |
| `TRUST_PROXY` | No | `1` | Cantidad de proxies delante del servidor (0 en local). Necesario detrás de un proxy para que el límite de intentos use la IP real del cliente. |
| `PORT` | No | `3000` | Puerto HTTP. Render lo define automáticamente. |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Origen(es) permitidos del frontend, separados por coma y sin barra final. Vacío = cualquier origen (solo desarrollo). |
| `NODE_ENV` | No | `production` | Entorno de ejecución. Por defecto `development`. |

En producción no hay archivo `.env`: las variables se configuran en el panel del proveedor (Render → *Environment*).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor cargando `.env`, con recarga automática (`node --watch`). |
| `npm start` | Inicia el servidor en modo normal (el que usa producción; no lee `.env`). |
| `npm test` | Ejecuta las pruebas (`node --test`). Carga `.env` si existe. Necesitan la base de datos encendida; las de autenticación además necesitan el esquema de `db/init/` (si falta, se omiten con un aviso). |
| `npm run lint` | Revisa el código con ESLint (obligatorio en CI). |
| `npm run format` | Aplica el formato de Prettier. |

## Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio y de la base de datos. **200** `{ status: "ok", database: "up", ... }` o **503** `{ status: "error", database: "down", ... }` si PostgreSQL no responde. Lo usan Render (health check) y el smoke test. |
| `POST` | `/api/v1/auth/register` | Crea una cuenta. Body `{ email, password }` (contraseña de 8+ caracteres). **201** `{ user: { id, email }, accessToken, refreshToken }` · **409** `EMAIL_TAKEN` · **422** `VALIDATION_ERROR` con `details` · **429** `RATE_LIMITED`. |
| `POST` | `/api/v1/auth/login` | Inicia sesión. **200** con la misma forma que el registro · **401** `UNAUTHORIZED` (sin indicar qué campo falló) · **429** `RATE_LIMITED`. |
| `POST` | `/api/v1/auth/refresh` | Body `{ refreshToken }`. **200** `{ accessToken, refreshToken }`; el token usado queda revocado (rotación) · **401** `UNAUTHORIZED`. |
| `POST` | `/api/v1/auth/logout` | Requiere access token. Body `{ refreshToken }`. Revoca esa sesión. **204**. |
| `GET` | `/api/v1/users/me` | Requiere access token. **200** `{ id, email, timezone }`. |

## Autenticación

- **Access token:** JWT firmado con `JWT_SECRET`, dura 15 minutos y viaja en `Authorization: Bearer <token>`. Solo lleva el id del usuario (`sub`).
- **Refresh token:** texto aleatorio que dura 30 días. En la base de datos se guarda **solo su hash** (tabla `refresh_tokens`), se revoca en el logout y **rota** en cada uso: un token ya usado no vuelve a servir.
- **Contraseñas:** se guardan con bcrypt (RNF-04); nunca salen en una respuesta.
- **401:** `TOKEN_EXPIRED` indica al frontend que debe llamar a `/auth/refresh`; `UNAUTHORIZED` que debe enviar al usuario al login.
- **Rutas protegidas:** se les antepone el middleware `requireAuth`, que deja el id del usuario en `req.userId`:

  ```js
  router.get('/me', requireAuth, getMe);
  ```

## Manejo de errores

Todo error termina en el middleware central (`middlewares/error.middleware.js`) y se responde con el formato único del contrato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "texto legible", "details": [{ "field": "amount", "problem": "Debe ser un número mayor que 0" }] } }
```

| Situación | HTTP | `code` |
|---|---|---|
| Ruta inexistente | 404 | `NOT_FOUND` |
| Body con JSON mal formado o con la forma equivocada | 400 | `VALIDATION_ERROR` |
| Datos que incumplen una regla | 422 | `VALIDATION_ERROR` con `details` |
| Sin token, token inválido o credenciales incorrectas | 401 | `UNAUTHORIZED` |
| Access token vencido | 401 | `TOKEN_EXPIRED` |
| Demasiados intentos de login o registro | 429 | `RATE_LIMITED` |
| Error esperado de negocio (`throw new AppError(...)`) | El del `AppError` | El del `AppError` |
| Error inesperado | 500 | `INTERNAL_ERROR` (sin detalles internos; el detalle queda en el log) |

Para lanzar un error esperado desde un service o controller:

```js
import { AppError } from '../errors/app-error.js';

throw new AppError(409, 'EMAIL_TAKEN', 'El correo ya está registrado');
```

## Convenciones de la API

- JSON sobre HTTPS (REST). Las rutas de negocio viven bajo `/api/v1`; `/health` queda en la raíz.
- Autenticación con `Authorization: Bearer <token>` en todos los endpoints salvo registro, login, refresh y health.
- Paginación: `?page=` y `?pageSize=` → `{ data, page, pageSize, total }`.
- Fechas de dominio en `YYYY-MM-DD`; timestamps del sistema en ISO 8601 UTC.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `/health` responde 503 / `ECONNREFUSED` | El contenedor está apagado | `docker start fintrack-db` |
| `password authentication failed` (a veces en español) | Te estás conectando a un PostgreSQL instalado en el sistema, no al contenedor | Revisa que `DATABASE_URL` use el puerto **5434** y que ese puerto no lo use otro programa (`netstat -ano \| grep 5434`) |
| `Cannot find module` al correr `npm run dev` | Estás en otra carpeta | Ejecuta los comandos desde `fintrack/backend` |
| `Conflict. The container name "/fintrack-db" is already in use` | Quedó un contenedor antiguo creado a mano con ese nombre | `docker rm -f fintrack-db` y luego `docker compose up -d db` |
| `relation "usuarios" does not exist` | La base de datos no tiene el esquema (volumen creado antes de `db/init/`) | Desde la raíz: `docker compose down -v` y `docker compose up -d db` (**borra los datos locales**) |
| El servidor no arranca: `Falta la variable de entorno JWT_SECRET` | `NODE_ENV=production` sin secreto configurado | Define `JWT_SECRET` en el entorno |

## Próximamente

- [x] Variables de entorno (`.env` / `.env.example`)
- [x] Conexión a PostgreSQL (Docker en local)
- [x] `GET /health` con verificación de la base de datos
- [x] Middleware central de errores
- [x] CORS para el frontend (variable `CORS_ORIGIN`)
- [x] `docker-compose` para levantar PostgreSQL y backend con un comando
- [x] Autenticación con JWT: registro, login, refresh, logout y `GET /users/me`
- [x] Límite de intentos en login y registro
- [ ] Documentación Swagger del contrato
