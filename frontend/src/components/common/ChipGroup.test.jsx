import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChipGroup from '@/components/common/ChipGroup';

const options = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
];
const render = (props) =>
  renderToStaticMarkup(<ChipGroup legend="Grupo" options={options} value="a" onChange={() => {}} {...props} />);

describe('ChipGroup', () => {
  it('cada pastilla es la caja de referencia de su radio oculto (evita que ensanche la página en celular)', () => {
    // El radio sr-only es `absolute`: sin `relative` en la etiqueta, en la fila deslizable se
    // posicionaba respecto a la página, la ensanchaba y Chrome del celular alejaba el zoom.
    for (const html of [render({}), render({ scroll: true })]) {
      const labels = html.match(/<label[^>]*>/g);
      expect(labels).toHaveLength(2);
      for (const label of labels) expect(label).toMatch(/class="[^"]*\brelative\b/);
    }
  });

  it('en modo scroll la fila se desliza en horizontal', () => {
    expect(render({ scroll: true })).toContain('overflow-x-auto');
  });

  it('marca la opción elegida y anuncia el grupo', () => {
    const html = render({});
    expect(html).toContain('<legend');
    expect(html).toMatch(/value="a"[^>]*checked|checked[^>]*value="a"/);
  });
});
