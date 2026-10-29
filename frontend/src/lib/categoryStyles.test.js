import { describe, expect, it } from 'vitest';
import { PawPrint, Shapes } from 'lucide-react';
import { COLOR_OPTIONS, ICON_OPTIONS, customStyle, getCategoryStyle, registerCategories } from '@/lib/categoryStyles';

describe('estilos de categorías propias', () => {
  it('hay 20 íconos y 8 colores, sin repetir (los mismos que acepta la API)', () => {
    expect(new Set(ICON_OPTIONS.map((o) => o.key)).size).toBe(20);
    expect(new Set(COLOR_OPTIONS.map((o) => o.key)).size).toBe(8);
  });

  it('customStyle usa el ícono y el color elegidos', () => {
    expect(customStyle({ icon: 'paw-print', color: 'amber' })).toEqual({
      icon: PawPrint,
      className: 'bg-amber-500/15 text-amber-500',
    });
  });

  it('después de registrar las categorías, getCategoryStyle dibuja las propias con solo la clave', () => {
    expect(getCategoryStyle('c_prueba0001').className).toBe('bg-ink/10 text-ink/60');
    registerCategories([
      { key: 'otros', name: 'Otros', custom: false },
      { key: 'c_prueba0001', name: 'Mascotas', icon: 'paw-print', color: 'teal', custom: true },
    ]);
    expect(getCategoryStyle('c_prueba0001')).toEqual({ icon: PawPrint, className: 'bg-teal-500/15 text-teal-500' });
    // Las de todos conservan su estilo fijo.
    expect(getCategoryStyle('otros').icon).toBe(Shapes);
  });
});
