import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SyncStatus from '@/components/layout/SyncStatus';

const render = (props) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <SyncStatus online pending={0} rejected={0} syncing={false} {...props} />
    </MemoryRouter>,
  );

describe('SyncStatus: estado de conexión y cola (FT-0008)', () => {
  it('con conexión y la cola vacía solo deja la región de estado, sin avisos', () => {
    const html = render();
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<p');
  });

  it('sin conexión avisa que se guarda en el dispositivo y cuenta los pendientes', () => {
    const html = render({ online: false, pending: 2 });
    expect(html).toContain('Sin conexión');
    expect(html).toContain('(2 pendientes)');
  });

  it('sin conexión y sin pendientes no muestra el contador', () => {
    expect(render({ online: false })).not.toContain('pendiente');
  });

  it('con conexión y pendientes: sincronizando o reintento automático', () => {
    expect(render({ pending: 1, syncing: true })).toContain('Sincronizando 1 movimiento…');
    expect(render({ pending: 3 })).toContain('3 movimientos pendientes de sincronizar');
  });

  it('rechazados: avisa y lleva a Movimientos, con o sin conexión', () => {
    const html = render({ rejected: 2 });
    expect(html).toContain('2 movimientos guardados sin conexión no se pudieron sincronizar');
    expect(html).toContain('href="/app/transacciones"');
    expect(html).toContain('text-negative');
    expect(render({ online: false, rejected: 1 })).toContain('Un movimiento guardado sin conexión no se pudo sincronizar');
  });

  it('pendientes y rechazados se muestran a la vez', () => {
    const html = render({ pending: 1, rejected: 1 });
    expect(html).toContain('1 movimiento pendiente de sincronizar');
    expect(html).toContain('no se pudo sincronizar');
  });
});
