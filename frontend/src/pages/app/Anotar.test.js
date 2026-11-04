import { describe, expect, it } from 'vitest';
import { pressKey, toTransaction } from '@/pages/app/Anotar';

describe('teclado de Anotar', () => {
  it('suma dígitos, 000 y borra el último', () => {
    let amount = '';
    for (const key of ['1', '5', '000']) amount = pressKey(amount, key);
    expect(amount).toBe('15000');
    expect(pressKey(amount, 'borrar')).toBe('1500');
  });

  it('no deja ceros a la izquierda ni pasa del máximo del servidor', () => {
    expect(pressKey('', '0')).toBe('');
    expect(pressKey('', '000')).toBe('');
    expect(pressKey('9999999999', '9')).toBe('9999999999');
  });
});

describe('toTransaction', () => {
  const base = { type: 'gasto', amount: '8000', description: ' Café ', category: 'ia', date: '2026-11-04', card: 'cash' };

  it('con "la IA la sugiere" y efectivo, va sin categoría ni tarjeta', () => {
    expect(toTransaction(base).values).toEqual({
      type: 'gasto', amount: 8000, description: 'Café', date: '2026-11-04', category: null, card: null, installments: null,
    });
  });

  it('con tarjeta va en una cuota; en un ingreso la tarjeta no aplica', () => {
    expect(toTransaction({ ...base, card: 'c1', category: 'alimentacion' }).values).toMatchObject({
      card: 'c1', installments: 1, category: 'alimentacion',
    });
    expect(toTransaction({ ...base, type: 'ingreso', card: 'c1' }).values).toMatchObject({ card: null, installments: null });
  });

  it('sin descripción devuelve el mismo error que el formulario', () => {
    expect(toTransaction({ ...base, description: '  ' }).error).toBe('Escribe una descripción');
  });
});
