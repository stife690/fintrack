import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContributionList from './ContributionList';
import MemberList from './MemberList';

const member = (overrides) => ({
  userId: 'u1',
  name: 'Ana',
  isMe: false,
  role: 'miembro',
  quota: 100000,
  customQuota: null,
  contributed: 40000,
  remaining: 60000,
  percentage: 40,
  status: 'atrasado',
  ...overrides,
});

const noop = async () => {};

describe('MemberList (FT-0015)', () => {
  const render = (props) =>
    renderToStaticMarkup(
      <MemberList members={[member()]} isAdmin={false} split="igual" online onUpdate={noop} onRemove={noop} {...props} />,
    );

  it('muestra cuánto lleva cada miembro, lo que le falta y su estado', () => {
    const html = render();
    expect(html).toContain('Ana');
    expect(html).toContain('Atrasado');
    expect(html).toMatch(/40\.000/);
    expect(html).toMatch(/Le faltan \$\s?60\.000/);
    expect(html).not.toContain('Gestionar');
  });

  it('el administrador gestiona a cada miembro desde su botón, sin llenar la lista de acciones', () => {
    const html = render({ isAdmin: true, split: 'personalizado' });
    expect(html).toContain('Gestionar a Ana');
    expect(html).not.toContain('Hacer admin');
    // Con partes iguales, a sí mismo no tiene nada que gestionarse.
    expect(render({ isAdmin: true, members: [member({ isMe: true })] })).not.toContain('Gestionar');
    expect(render({ isAdmin: true, split: 'personalizado', members: [member({ isMe: true })] })).toContain('Gestionar');
  });
});

describe('ContributionList (FT-0015)', () => {
  const contribution = {
    id: 'c1',
    userId: 'u2',
    name: 'Beto',
    isMe: false,
    amount: 25000,
    note: 'Mi parte',
    date: '2026-10-30',
    createdAt: '2026-10-30T15:00:00Z',
  };

  it('sin aportes invita a poner el primero', () => {
    expect(
      renderToStaticMarkup(<ContributionList contributions={[]} pending={[]} online onDelete={noop} onDiscard={noop} />),
    ).toContain('Todavía no hay aportes');
  });

  it('muestra los pendientes del dispositivo antes que los confirmados; solo el propio se puede borrar', () => {
    const html = renderToStaticMarkup(
      <ContributionList
        contributions={[contribution, { ...contribution, id: 'c2', isMe: true, name: 'Ana' }]}
        pending={[{ localId: 'l1', contribution: { amount: 5000, date: '2026-10-30', note: null } }]}
        online
        onDelete={noop}
        onDiscard={noop}
      />,
    );
    expect(html.indexOf('Pendiente')).toBeLessThan(html.indexOf('Beto'));
    expect(html).toContain('Mi parte');
    expect(html.match(/Borrar aporte/g)).toHaveLength(1);
  });

  it('un pendiente rechazado muestra el motivo y Descartar', () => {
    const html = renderToStaticMarkup(
      <ContributionList
        contributions={[]}
        pending={[{ localId: 'l1', rejected: 'Vaca no encontrada', contribution: { amount: 5000, date: '2026-10-30', note: null } }]}
        online
        onDelete={noop}
        onDiscard={noop}
      />,
    );
    expect(html).toContain('No se pudo registrar: Vaca no encontrada');
    expect(html).toContain('Descartar');
  });
});
