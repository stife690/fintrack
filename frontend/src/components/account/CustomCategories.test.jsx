import { describe, expect, it } from 'vitest';
import { deletedMessage } from '@/components/account/CustomCategories';

describe('deletedMessage', () => {
  it('dice cuántos movimientos cambiaron y a qué categoría', () => {
    expect(deletedMessage(3, 'gasto')).toBe('Categoría eliminada. 3 movimientos pasaron a Otros.');
    expect(deletedMessage(1, 'ingreso')).toBe('Categoría eliminada. 1 movimiento pasó a Otros ingresos.');
    expect(deletedMessage(0, 'gasto')).toBe('Categoría eliminada.');
  });
});
