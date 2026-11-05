import { describe, expect, it } from 'vitest';
import { LEAD, jumpFor, scrollAt, segmentAt, segmentForScroll } from './timeline';

const SEGMENTS = [
  { start: 0, end: 5 },
  { start: 6, end: 10 },
  { start: 11, end: 15 },
];
const TOPS = [0, 800, 2000];

describe('segmentAt', () => {
  it('devuelve la frase que ya empezó (contando la antelación)', () => {
    expect(segmentAt(0, SEGMENTS)).toBe(0);
    expect(segmentAt(5.9 - LEAD, SEGMENTS)).toBe(0);
    expect(segmentAt(6 - LEAD, SEGMENTS)).toBe(1);
    expect(segmentAt(99, SEGMENTS)).toBe(2);
  });
});

describe('scrollAt', () => {
  it('se queda arriba durante la primera frase', () => {
    expect(scrollAt(3, SEGMENTS, TOPS)).toBe(0);
  });

  it('baja de forma suave hasta la sección de la frase', () => {
    const from = 6 - LEAD;
    const mid = scrollAt(from + 0.55, SEGMENTS, TOPS, 1.1);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(800);
    expect(scrollAt(from + 1.1, SEGMENTS, TOPS, 1.1)).toBe(800);
    expect(scrollAt(9, SEGMENTS, TOPS, 1.1)).toBe(800);
  });

  it('salta sin animación cuando glide es 0 (movimiento reducido)', () => {
    expect(scrollAt(6 - LEAD + 0.1, SEGMENTS, TOPS, 0)).toBe(800);
  });
});

describe('segmentForScroll', () => {
  it('elige la última sección que ya pasó el 30% superior de la pantalla', () => {
    expect(segmentForScroll(0, TOPS, 1000)).toBe(0);
    expect(segmentForScroll(600, TOPS, 1000)).toBe(1);
    expect(segmentForScroll(1800, TOPS, 1000)).toBe(2);
  });
});

describe('jumpFor', () => {
  const NAMED = [
    { id: 'inicio', start: 0 },
    { id: 'funcionalidades', start: 26.82 },
    { id: 'seguridad', start: 43.69 },
  ];

  it('un enlace a una sección del recorrido salta a su frase, un poco antes para que la página baje', () => {
    expect(jumpFor('#seguridad', NAMED)).toEqual({ index: 2, time: 43.69 - LEAD });
    expect(jumpFor('#funcionalidades', NAMED)).toEqual({ index: 1, time: 26.82 - LEAD });
  });

  it('una sección de la que la voz no habla (o el inicio) no salta: se pausa', () => {
    expect(jumpFor('#faq', NAMED)).toBeNull();
    expect(jumpFor('#contenido', NAMED)).toBeNull();
    expect(jumpFor('#inicio', NAMED)).toBeNull();
  });
});
