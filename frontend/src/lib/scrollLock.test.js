import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lockScroll } from '@/lib/scrollLock';

describe('lockScroll', () => {
  beforeEach(() => vi.stubGlobal('document', { body: { style: { overflow: '' } } }));
  afterEach(() => vi.unstubAllGlobals());

  it('bloquea y libera', () => {
    const unlock = lockScroll();
    expect(document.body.style.overflow).toBe('hidden');
    unlock();
    expect(document.body.style.overflow).toBe('');
  });

  it('con dos ventanas libera al cerrar la última, sin importar el orden', () => {
    const first = lockScroll();
    const second = lockScroll();
    first();
    expect(document.body.style.overflow).toBe('hidden');
    second();
    expect(document.body.style.overflow).toBe('');
  });
});
