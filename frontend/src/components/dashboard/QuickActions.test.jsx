import { describe, expect, it } from 'vitest';
import { CIRCLES } from '@/components/dashboard/QuickActions';

describe('círculos del inicio', () => {
  it('empiezan con Anotar', () => {
    expect(CIRCLES[0]).toMatchObject({ label: 'Anotar', primary: true });
  });

  it('llevan a las secciones que ya no están en un menú, sin repetirse', () => {
    const paths = CIRCLES.map(({ to }) => to);
    for (const path of ['/app/presupuestos', '/app/insights', '/app/tarjetas', '/app/cuentas', '/app/vacas']) {
      expect(paths).toContain(path);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });
});
