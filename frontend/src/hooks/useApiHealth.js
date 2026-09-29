import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';

/**
 * Consulta `GET {API_URL}/health` al montarse.
 * @returns {'loading'|'ok'|'error'} Estado de la conexión con el backend.
 */
export default function useApiHealth() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((res) => res.json().then((data) => setStatus(res.ok && data.status === 'ok' ? 'ok' : 'error')))
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, []);

  return status;
}
