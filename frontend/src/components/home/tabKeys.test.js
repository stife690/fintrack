import { describe, expect, it, vi } from 'vitest';
import { handleTabKeys } from './tabKeys';

/** Evento falso: una lista de 3 pestañas con `focus` espiado. */
function fakeEvent(key) {
  const tabs = [0, 1, 2].map(() => ({ focus: vi.fn() }));
  return {
    key,
    preventDefault: vi.fn(),
    currentTarget: { querySelectorAll: () => tabs },
    tabs,
  };
}

describe('handleTabKeys', () => {
  it('flecha derecha avanza y da la vuelta al final', () => {
    const select = vi.fn();
    const e = fakeEvent('ArrowRight');
    handleTabKeys(e, 2, 3, select);
    expect(select).toHaveBeenCalledWith(0);
    expect(e.tabs[0].focus).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('flecha izquierda retrocede y da la vuelta al inicio', () => {
    const select = vi.fn();
    handleTabKeys(fakeEvent('ArrowLeft'), 0, 3, select);
    expect(select).toHaveBeenCalledWith(2);
  });

  it('Inicio y Fin van a los extremos', () => {
    const select = vi.fn();
    handleTabKeys(fakeEvent('Home'), 1, 3, select);
    handleTabKeys(fakeEvent('End'), 1, 3, select);
    expect(select.mock.calls).toEqual([[0], [2]]);
  });

  it('ignora otras teclas sin cancelar el evento', () => {
    const select = vi.fn();
    const e = fakeEvent('Enter');
    handleTabKeys(e, 1, 3, select);
    expect(select).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
