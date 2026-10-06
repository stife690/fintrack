# FinTrack

PWA *offline-first* de control de gastos personales con categorización automática e insights financieros generados por IA.

Proyecto final de **Computación en el Servidor** — Ingeniería de Software, Universidad Surcolombiana (USCO). Se presenta en **INNOVASOFT IX**.

## Arquitectura

Cliente-servidor de 3 capas:

```
Frontend (PWA, React)  →  Backend (API REST, Express)  →  PostgreSQL
                                     ↓
                               LLM externo (IA)
```

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| [`backend/`](backend/) | API REST en Node.js + Express. Ver [backend/README.md](backend/README.md). |
| `frontend/` | PWA en Vite + React *(pendiente)*. |
| [`db/init/`](db/init/) | Esquema SQL (Modelo Relacional v2.0) y catálogo de categorías; los carga `docker-compose.yml`. |
| `.github/workflows/` | Integración continua (GitHub Actions). |

## Flujo de trabajo

- La rama `main` es la versión estable. Se trabaja en ramas propias y se integra con Pull Request.
- Toda PR la revisa un integrante distinto al autor.
- Los secretos (`.env`) nunca se suben al repositorio.

## Entorno local rápido

```bash
docker compose up -d db      # PostgreSQL con el esquema ya creado
cd backend && npm install && npm run dev
```

Detalle en [backend/README.md](backend/README.md).

## Integración continua

En cada push a `main` y en cada Pull Request, GitHub Actions ([`ci.yml`](.github/workflows/ci.yml)) corre:

1. **Backend:** `npm ci`, lint (si existe), `npm test` y la validación del esquema SQL contra un PostgreSQL real.
2. **Docker:** valida `docker-compose.yml`, construye la imagen del backend y prueba `GET /health`.
3. **Frontend:** instala, prueba y compila; se activa solo cuando exista `frontend/package.json`.

Se recomienda proteger `main` exigiendo que estos checks pasen antes de hacer merge.
