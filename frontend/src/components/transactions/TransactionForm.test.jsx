import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TransactionForm from '@/components/transactions/TransactionForm';
import { transactionSchema } from '@/lib/validation/transaction';

// El selector de categorías usa un portal (necesita `document`); aquí no interesa.
vi.mock('@/components/categories/CategoryPicker', () => ({ default: () => null, AUTO_CATEGORY: '' }));

const categories = { expense: [], income: [] };
const cards = [{ id: 'c1', network: 'amex', name: 'Mi Amex', last4: '1234' }];
const render = (props) =>
  renderToStaticMarkup(<TransactionForm categories={categories} onSubmit={async () => {}} {...props} />);

describe('TransactionForm: Pagado con', () => {
  it('sin tarjetas no aparece la fila', () => {
    expect(render({ cards: [] })).not.toContain('Pagado con');
    expect(render({})).not.toContain('Pagado con');
  });

  it('con una tarjeta muestra los chips y deja "Efectivo o débito" elegido', () => {
    const html = render({ cards });
    expect(html).toContain('Pagado con');
    expect(html).toContain('Efectivo o débito');
    expect(html).toContain('Amex ••1234');
    expect(html).toMatch(/value="cash"[^>]*checked|checked[^>]*value="cash"/);
    expect(html).not.toContain('Cuotas');
  });

  it('en un gasto con tarjeta aparece Cuotas', () => {
    const initial = { id: 't', type: 'gasto', amount: 10, description: 'x', date: '2026-10-01', category: null, card: { id: 'c1', name: 'a', last4: '1234', deleted: false }, installments: 3 };
    const html = render({ cards, initial });
    expect(html).toContain('Cuotas');
  });

  it('al editar un gasto sin tarjeta se puede asignar una', () => {
    const initial = { id: 't', type: 'gasto', amount: 10, description: 'x', date: '2026-10-01', category: null, card: null, installments: null };
    expect(render({ cards, initial })).toContain('Amex ••1234');
  });

  it('en Ingreso la fila desaparece', () => {
    expect(render({ cards, defaultType: 'ingreso' })).not.toContain('Pagado con');
  });
});

describe('transactionSchema: tarjeta y cuotas', () => {
  const base = { type: 'gasto', amount: '1000', description: 'x', date: '2026-10-01', category: '' };
  it('un ingreso envía card y installments en null', () => {
    expect(transactionSchema.parse({ ...base, type: 'ingreso', card: 'c1', installments: '3' })).toMatchObject({ card: null, installments: null });
  });
  it('gasto en efectivo: sin cuotas', () => {
    expect(transactionSchema.parse({ ...base, card: null, installments: '1' })).toMatchObject({ card: null, installments: null });
  });
  it('gasto con tarjeta lleva las cuotas como número', () => {
    expect(transactionSchema.parse({ ...base, card: 'c1', installments: '12' })).toMatchObject({ card: 'c1', installments: 12 });
  });
  it('cuotas vacías, 0 o 49 se rechazan con tarjeta', () => {
    for (const installments of ['', '0', '49']) {
      expect(transactionSchema.safeParse({ ...base, card: 'c1', installments }).success).toBe(false);
    }
  });
});
