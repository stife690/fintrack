# Guía de contribución

## Flujo de trabajo

1. Parte siempre de `main` actualizado: `git switch main && git pull`.
2. Crea una rama propia por cambio: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `ci/…`.
3. Haz commits pequeños con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):
   `feat(backend): agregar registro de usuarios`.
4. Antes de abrir la PR, ejecuta las pruebas (`npm test` en `backend/`) y el build (`npm run build` en `frontend/`).
5. Abre una PR hacia `main`; la revisa un integrante distinto al autor y el CI debe estar en verde.
6. No subas secretos ni archivos `.env`.

## Código

- Backend: arquitectura por capas `routes → controllers → services → repositories`; los controllers no escriben SQL.
- Documenta con JSDoc las funciones, clases y módulos públicos.
- Los errores se lanzan como `AppError` (ver `backend/src/errors/app-error.js`); nunca se responde un error a mano.
- Toda variable de entorno se lee en `backend/src/config/env.js`.
- Cada cambio de comportamiento lleva su prueba (`node --test`).
- Si cambias un endpoint, actualiza antes `docs/api/openapi.yaml`.

## Variables de entorno

| Variable | Dónde | Descripción | Por defecto |
|---|---|---|---|
| `PORT` | backend | Puerto HTTP | `3000` |
| `NODE_ENV` | backend | `development` / `production` (en producción no se exponen mensajes de errores internos) | `development` |
| `CORS_ORIGIN` | backend | Orígenes permitidos, separados por coma y sin barra final | cualquiera (solo local) |
| `DATABASE_URL` | backend | Cadena de conexión a PostgreSQL | ver `docs/entorno-local.md` |
| `FRONTEND_URL`, `API_URL` | `scripts/smoke-test.mjs` | URLs a verificar tras un despliegue | — |

Entorno local: [docs/entorno-local.md](docs/entorno-local.md). Despliegue: [docs/despliegue.md](docs/despliegue.md).

## Calidad de código

En `backend/`: `npm run lint` (ESLint + reglas JSDoc, obligatorio en CI), `npm run format` (Prettier) y `npm run format:check`. El editor debe respetar `.editorconfig` (LF, 2 espacios).
