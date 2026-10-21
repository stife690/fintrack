import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ConflictList from '@/components/transactions/ConflictList';

const alive = { id: 's1', description: 'Almuerzo', deletedAt: null };

const lost = { localId: 'l1', resolution: 'server_wins', op: 'update', serverVersion: alive, name: 'Almuerzo' };
const won = { localId: 'l2', resolution: 'client_wins', op: 'delete', serverVersion: { ...alive, deletedAt: 'x' }, name: 'Bus' };

const render = (conflicts) => renderToStaticMarkup(<ConflictList conflicts={conflicts} onDismiss={() => {}} />);

describe('ConflictList (FT-0009)', () => {
  it('muestra el mensaje de cada conflicto con su botón Entendido', () => {
    const html = render([lost, won]);
    expect(html).toContain('Conflictos de sincronización (2)');
    expect(html).toContain('Tu edición de «Almuerzo» no se aplicó');
    expect(html).toContain('Eliminaste «Bus»');
    expect(html.match(/>Entendido</g)).toHaveLength(2);
  });

  it('la advertencia y el aviso informativo se distinguen por color', () => {
    expect(render([lost])).toContain('text-caution');
    const info = render([won]);
    expect(info).toContain('text-brand');
    expect(info).not.toContain('text-caution');
  });

  it('con un solo conflicto no ofrece "Entendido todos"', () => {
    expect(render([lost])).not.toContain('Entendido todos');
    expect(render([lost, won])).toContain('Entendido todos');
  });

  it('el botón Entendido nombra el conflicto para el lector de pantalla', () => {
    expect(render([lost])).toContain('<span class="sr-only">: Tu edición de «Almuerzo» no se aplicó');
  });
});
