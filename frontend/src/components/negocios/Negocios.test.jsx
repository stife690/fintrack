import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PartnerList from './PartnerList';
import { formatShare, inviteLink } from './negocioFormat';

const partner = (overrides) => ({
  userId: 'u1',
  name: 'Ana',
  email: null,
  role: 'editor',
  share: null,
  isMe: false,
  joinedAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

const noop = async () => {};

describe('PartnerList (FT-0016)', () => {
  const render = (props) =>
    renderToStaticMarkup(<PartnerList partners={[partner()]} isOwner={false} online onUpdate={noop} onRemove={noop} {...props} />);

  it('muestra el rol y la participación de cada socio', () => {
    const html = render({ partners: [partner({ share: 40 })] });
    expect(html).toContain('Ana');
    expect(html).toContain('Editor');
    expect(html).toContain('40 %');
    expect(html).not.toContain('Sacar');
  });

  it('el dueño gestiona a cada socio desde su botón y ve sus correos', () => {
    const html = render({
      isOwner: true,
      partners: [partner({ userId: 'me', name: 'Yo', isMe: true, role: 'dueno' }), partner({ email: 'ana@x.co' })],
    });
    expect(html).toContain('Gestionar a Yo');
    expect(html).toContain('Gestionar a Ana');
    expect(html).not.toContain('Sacar');
    expect(html).toContain('ana@x.co');
  });
});

describe('negocioFormat', () => {
  it('arma el enlace de invitación y formatea la participación', () => {
    expect(inviteLink('K7M2QX', 'https://fintrackcol.online')).toBe('https://fintrackcol.online/app/negocios/unirse/K7M2QX');
    expect(formatShare(33.33)).toBe('33,33 %');
  });
});
