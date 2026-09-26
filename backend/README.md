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

3. Iniciar en modo desarrollo (se reinicia solo al guardar cambios):

   ```bash
   npm run dev
   ```

4. Abrir <http://localhost:3000>.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor con `node --watch` (recarga automática). |
| `npm start` | Inicia el servidor en modo normal (el que usa producción). |

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
- [ ] Conexión a PostgreSQL (Docker en local)
- [ ] `GET /health` con verificación de la base de datos
- [ ] Middleware central de errores
- [ ] CORS para el frontend
