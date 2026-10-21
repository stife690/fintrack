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

  it('conflicto donde su cambio no se aplicó: advertencia con enlace al detalle', () => {
    const html = render({ conflicts: 1, conflictsLost: 1 });
    expect(html).toContain('1 cambio tuyo no se aplicó porque otro dispositivo lo modificó después');
    expect(html).toContain('href="/app/transacciones"');
    expect(html).toContain('text-caution');
    expect(render({ conflicts: 3, conflictsLost: 2 })).toContain('2 cambios tuyos no se aplicaron');
  });

  it('conflictos resueltos a su favor: aviso informativo', () => {
    expect(render({ conflicts: 1 })).toContain('Un conflicto de sincronización se resolvió a tu favor');
    const html = render({ conflicts: 2 });
    expect(html).toContain('2 conflictos de sincronización se resolvieron a tu favor');
    expect(html).not.toContain('text-caution');
  });

  it('sin conflictos no aparece el aviso', () => {
    expect(render({ conflicts: 0, conflictsLost: 0 })).not.toContain('Ver detalle');
  });

  it('pendientes y rechazados se muestran a la vez', () => {
    const html = render({ pending: 1, rejected: 1 });
    expect(html).toContain('1 movimiento pendiente de sincronizar');
    expect(html).toContain('no se pudo sincronizar');
  });
});
