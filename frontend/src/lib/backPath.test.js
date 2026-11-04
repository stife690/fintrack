import { describe, expect, it } from 'vitest';
import { backPath, canGoBack } from '@/lib/backPath';

describe('canGoBack', () => {
  it('va atrás solo si hay una pantalla anterior en la app', () => {
    expect(canGoBack({ idx: 2 })).toBe(true);
    expect(canGoBack({ idx: 0 })).toBe(false);
  });

  it('sin datos del enrutador, no intenta ir atrás', () => {
    expect(canGoBack(null)).toBe(false);
    expect(canGoBack({})).toBe(false);
  });
});

describe('backPath', () => {
  it('no ofrece volver desde el inicio', () => {
    expect(backPath('/app')).toBeNull();
    expect(backPath('/app/')).toBeNull();
  });

  it('lleva las secciones principales al inicio', () => {
    for (const path of ['/app/transacciones', '/app/presupuestos', '/app/insights', '/app/tarjetas', '/app/cuentas', '/app/vacas', '/app/cuenta']) {
      expect(backPath(path)).toBe('/app');
    }
  });

  it('lleva cada detalle a su sección', () => {
    expect(backPath('/app/tarjetas/12')).toBe('/app/tarjetas');
    expect(backPath('/app/transacciones/abc')).toBe('/app/mi-plata');
    expect(backPath('/app/transacciones/exportar')).toBe('/app/cuenta');
    expect(backPath('/app/vacas/12')).toBe('/app/vacas');
    expect(backPath('/app/vacas/unirse/ABC')).toBe('/app/vacas');
    expect(backPath('/app/negocios/12')).toBe('/app/negocios');
  });

  it('lleva lo que se abre desde otra pantalla a esa pantalla', () => {
    expect(backPath('/app/calendario')).toBe('/app/mi-plata');
    expect(backPath('/app/renta')).toBe('/app/insights');
    expect(backPath('/app/transacciones/exportar')).toBe('/app/cuenta');
    expect(backPath('/app/lo-que-viene/admin')).toBe('/app/lo-que-viene');
  });
});
