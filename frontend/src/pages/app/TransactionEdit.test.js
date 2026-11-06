import { describe, expect, it } from 'vitest';
import { changedFields, savedMessage } from '@/pages/app/TransactionEdit';

const base = { type: 'gasto', amount: 10, description: 'Café', date: '2026-11-01', category: 'alimentacion', card: null, installments: null };

describe('changedFields', () => {
  it('sin cambios no envía nada', () => {
    expect(changedFields(base, { ...base })).toEqual({});
  });

  it('envía solo lo que cambió', () => {
    expect(changedFields(base, { ...base, amount: 20, category: 'salud' })).toEqual({ amount: 20, category: 'salud' });
  });

  it('una tarjeta eliminada cuenta como sin tarjeta', () => {
    const initial = { ...base, card: { id: 7, deleted: true }, installments: 3 };
    expect(changedFields(initial, { ...base })).toEqual({});
  });
});

describe('savedMessage', () => {
  it('dice cómo quedó la categoría', () => {
    expect(savedMessage({ source: 'ia', category: 'salud' }, { salud: 'Salud' })).toContain('sugerida por IA');
    expect(savedMessage({ source: 'sin_clasificar', category: null }, {})).toContain('sin clasificar');
  });
});
