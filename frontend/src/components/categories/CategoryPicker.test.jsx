import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// El portal de la ventana necesita el DOM; aquí solo se revisa el selector.
vi.mock('@/components/categories/NewCategoryDialog', () => ({ default: () => null }));
const { default: CategoryPicker } = await import('@/components/categories/CategoryPicker');

const categories = [
  { key: 'alimentacion', name: 'Alimentación' },
  { key: 'c_prueba0001', name: 'Mascotas', icon: 'paw-print', color: 'teal', custom: true },
];
const render = (props) =>
  renderToStaticMarkup(<CategoryPicker legend="Categoría" categories={categories} value="" onChange={() => {}} {...props} />);

describe('CategoryPicker', () => {
  beforeAll(() => vi.stubGlobal('navigator', { onLine: true }));
  afterAll(() => vi.unstubAllGlobals());

  it('muestra las categorías propias junto a las de todos', () => {
    const html = render();
    expect(html).toContain('Alimentación');
    expect(html).toContain('Mascotas');
  });

  it('solo ofrece "Nueva" cuando se indica el tipo a crear', () => {
    expect(render()).not.toContain('Nueva');
    expect(render({ createType: 'gasto' })).toContain('Nueva');
  });

  it('mientras cargan las categorías no ofrece crear una', () => {
    expect(render({ createType: 'gasto', categories: [] })).not.toContain('Nueva');
  });

  it('con createType las propias llevan un lápiz para editarlas; las de todos no', () => {
    const html = render({ createType: 'gasto' });
    expect(html).toContain('aria-label="Editar Mascotas"');
    expect(html).not.toContain('Editar Alimentación');
    expect(render()).not.toContain('Editar Mascotas');
  });
});
