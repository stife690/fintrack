import { useEffect, useState } from 'react';

/**
 * URL base del backend, sin barra final.
 * En Vercel se define `VITE_API_URL` con la URL pública de Render;
 * en local usa `http://localhost:3000`.
 * @type {string}
 */
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Pantalla hello world de FinTrack.
 *
 * Al montarse consulta `GET {API_URL}/health` y muestra uno de tres estados:
 * `loading` (conectando), `ok` (respuesta del backend) o `error` (falló la conexión).
 *
 * @returns {JSX.Element} Tarjeta con el estado de la conexión frontend ↔ backend.
 */
export default function App() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setState({ status: 'ok', data }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  return (
    <main className="card">
      <h1>FinTrack</h1>
      <p>Hello world: frontend desplegado ✅</p>
      <h2>Backend</h2>
      {state.status === 'loading' && <p>Conectando con la API…</p>}
      {state.status === 'ok' && (
        <>
          <p className="ok">Conectado ✅ — {state.data.message}</p>
          <pre>{JSON.stringify(state.data, null, 2)}</pre>
        </>
      )}
      {state.status === 'error' && (
        <p className="error">No se pudo conectar con {API_URL}: {state.message}</p>
      )}
    </main>
  );
}
