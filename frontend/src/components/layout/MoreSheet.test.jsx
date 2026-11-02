import { describe, expect, it } from 'vitest';
import { MORE_GROUPS, isMorePath } from '@/components/layout/MoreSheet';

describe('isMorePath', () => {
  it('reconoce las secciones de Más y sus subrutas', () => {
    expect(isMorePath('/app/presupuestos')).toBe(true);
    expect(isMorePath('/app/vacas/12')).toBe(true);
    expect(isMorePath('/app/transacciones/exportar')).toBe(true);
  });

  it('no marca las secciones que están en la barra', () => {
    expect(isMorePath('/app')).toBe(false);
    expect(isMorePath('/app/transacciones')).toBe(false);
    expect(isMorePath('/app/insights')).toBe(false);
  });
});

describe('MORE_GROUPS', () => {
  it('no repite secciones', () => {
    const paths = MORE_GROUPS.flatMap(({ items }) => items.map(({ to }) => to));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
