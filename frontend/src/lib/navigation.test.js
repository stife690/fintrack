import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CIRCLES } from '@/components/dashboard/QuickActions';
import { LINKS } from '@/pages/app/Account';

/** Rutas que no necesitan entrada: el inicio, redirecciones, flujos automáticos y la vista de administración. */
const NO_ENTRY = ['/app', '/app/bienvenida', '/app/notificaciones', '/app/lo-que-viene/admin'];

/** Entradas que están dentro de una pantalla, no en una lista. */
const INSIDE_SCREENS = {
  '/app/cuenta': 'avatar del inicio',
  '/app/transacciones': '"Ver todos" en Últimos movimientos',
  '/app/mi-plata': 'tarjeta morada del inicio',
  '/app/calendario': 'Mi plata',
  '/app/renta': 'Consejos',
  '/app/negocios': 'selector de En grupo',
};

describe('navegación en celular', () => {
  it('toda ruta de la app tiene por dónde llegar, ya que no hay menú', () => {
    const app = readFileSync('src/App.jsx', 'utf8');
    const routes = [...app.matchAll(/path="(\/app[^"]*)"/g)].map(([, path]) => path).filter((path) => !path.includes(':'));
    expect(routes.length).toBeGreaterThan(10);

    const entries = new Set([
      ...CIRCLES.map(({ to }) => to.split('?')[0]),
      ...LINKS.map(({ to }) => to),
      ...Object.keys(INSIDE_SCREENS),
      ...NO_ENTRY,
    ]);
    expect(routes.filter((path) => !entries.has(path))).toEqual([]);
  });
});
