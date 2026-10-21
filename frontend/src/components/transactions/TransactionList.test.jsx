import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TransactionList from '@/components/transactions/TransactionList';

const transactions = [
  { id: 'a', description: 'Almuerzo', amount: 15000, type: 'gasto', date: '2026-10-20', category: null, source: 'manual' },
  { id: 'b', description: 'Bus', amount: 3000, type: 'gasto', date: '2026-10-20', category: null, source: 'manual' },
  { id: 'c', description: 'Mercado', amount: 80000, type: 'gasto', date: '2026-10-19', category: null, source: 'manual' },
];

const render = (pendingStatus) =>
  renderToStaticMarkup(
    <TransactionList
      transactions={transactions}
      categoryNames={{}}
      pendingStatus={pendingStatus}
      page={1}
      pageSize={20}
      total={3}
      onPageChange={() => {}}
      onEdit={() => {}}
      onDelete={async () => {}}
    />,
  );

describe('TransactionList: etiqueta de sincronización (FT-0008)', () => {
  it('marca solo el movimiento con un cambio pendiente', () => {
    const html = render(new Map([['a', 'pending']]));
    expect(html.match(/Pendiente de sincronizar/g)).toHaveLength(1);
    expect(html).not.toContain('No se pudo sincronizar');
  });

  it('un cambio rechazado por el servidor se muestra distinto, en rojo', () => {
    const html = render(new Map([['b', 'rejected']]));
    expect(html).toContain('No se pudo sincronizar');
    expect(html).toContain('text-negative');
    expect(html).not.toContain('Pendiente de sincronizar');
  });

  it('sin cambios en la cola no aparece ninguna etiqueta', () => {
    expect(render(new Map())).not.toContain('sincronizar');
  });

  it('funciona aunque no se pase pendingStatus', () => {
    expect(render(undefined)).toContain('Almuerzo');
  });
});
