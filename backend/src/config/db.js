import pg from 'pg';
import { env } from './env.js';

/**
 * Pool de conexiones a PostgreSQL compartido por toda la aplicación.
 * Reutiliza conexiones abiertas en vez de abrir una nueva por petición.
 * Solo la capa `repositories/` debe usarlo.
 */
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,// Si la BD no responde en 5 s, falla en vez de esperar para siempre.
  connectionTimeoutMillis: 5000,
});

// Si una conexión inactiva del pool falla (p. ej. se reinicia la BD),
// se registra el error en vez de tumbar todo el servidor.
pool.on('error', (err) => {
  console.error('Error en una conexión inactiva de PostgreSQL:', err.message);
});
