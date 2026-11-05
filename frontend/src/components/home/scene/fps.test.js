import { describe, expect, it } from 'vitest';
import { createFpsMeter } from './fps';

/** Pasa `count` cuadros de `delta` segundos y devuelve el último veredicto. */
const feed = (meter, delta, count) => {
  let verdict = 'measuring';
  for (let i = 0; i < count; i += 1) verdict = meter(delta);
  return verdict;
};

describe('createFpsMeter', () => {
  it('a 60 cuadros por segundo se queda con el 3D', () => {
    const meter = createFpsMeter();
    expect(feed(meter, 1 / 60, 200)).toBe('ok');
  });

  it('a 20 cuadros por segundo pide el logo plano', () => {
    const meter = createFpsMeter();
    expect(feed(meter, 1 / 20, 60)).toBe('slow');
  });

  it('no decide durante el calentamiento aunque los primeros cuadros sean lentos', () => {
    const meter = createFpsMeter({ warmup: 0.4, sample: 1.5 });
    expect(feed(meter, 0.2, 2)).toBe('measuring');
    expect(feed(meter, 1 / 60, 200)).toBe('ok');
  });

  it('ignora las pausas largas (pestaña oculta) como si no hubieran pasado', () => {
    const meter = createFpsMeter();
    feed(meter, 1 / 60, 40);
    expect(meter(5)).toBe('measuring');
    expect(feed(meter, 1 / 60, 200)).toBe('ok');
  });
});
