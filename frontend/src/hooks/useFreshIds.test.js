import { describe, expect, it } from 'vitest';
import { pickFresh } from '@/hooks/useFreshIds';

describe('pickFresh', () => {
  it('lo primero que se carga no es nuevo', () => {
    expect(pickFresh(new Set(), ['a', 'b', 'c'])).toEqual([]);
  });

  it('marca lo que llega después', () => {
    const seen = new Set(['a']);
    expect(pickFresh(seen, ['b', 'a'])).toEqual(['b']);
    expect(pickFresh(seen, ['b', 'a'])).toEqual([]);
  });

  it('no marca una lista distinta', () => {
    expect(pickFresh(new Set(['a']), ['x', 'y', 'z'])).toEqual([]);
  });
});
