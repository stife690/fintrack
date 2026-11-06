import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CONTACT_EMAIL, LEGAL_VERSION, PRIVACY, RESPONSIBLES, TERMS } from './legalContent';
import Privacy from './Privacy';
import Terms from './Terms';
import { versionDate } from './LegalPage';

let authUser = null;
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: authUser, updateUser: vi.fn(), signOut: vi.fn() }),
}));

const { default: TermsGate } = await import('@/components/legal/TermsGate');

const render = (node) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
const allText = (sections) => sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.items ?? [])]).join(' ');

describe('Términos y privacidad (FT-0017)', () => {
  it('la versión es una fecha AAAA-MM-DD y se muestra legible', () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(versionDate('2026-11-05')).toBe('5 de noviembre de 2026');
  });

  it('las dos páginas muestran el correo de contacto, la versión y el enlace a la otra', () => {
    const terms = render(<Terms />);
    expect(terms).toContain('Términos de uso');
    expect(terms).toContain(CONTACT_EMAIL);
    expect(terms).toContain(versionDate(LEGAL_VERSION));
    expect(terms).toContain('href="/privacidad"');

    const privacy = render(<Privacy />);
    expect(privacy).toContain('Política de privacidad');
    expect(privacy).toContain('href="/terminos"');
  });

  it('la política nombra a los responsables, la ley y cada servicio que procesa datos', () => {
    const text = allText(PRIVACY);
    for (const name of RESPONSIBLES) expect(text).toContain(name);
    for (const provider of ['Supabase', 'Render', 'Vercel', 'Gemini', 'Groq', 'WhatsApp', 'Brevo']) {
      expect(text).toContain(provider);
    }
    expect(text).toContain('Ley 1581 de 2012');
    expect(allText(TERMS)).toContain('no son asesoría financiera');
  });
});

describe('TermsGate', () => {
  it('pide aceptar solo a quien no ha aceptado la versión vigente', () => {
    authUser = { id: 'u1', termsAccepted: false };
    const html = render(<TermsGate />);
    expect(html).toContain('Acepto los términos y la política');
    expect(html).toContain('Cerrar sesión');
    expect(html).toContain('href="/privacidad"');

    authUser = { id: 'u1', termsAccepted: true };
    expect(render(<TermsGate />)).toBe('');
    // Sin el dato todavía (perfil sin sincronizar o sin conexión) no bloquea.
    authUser = { id: 'u1' };
    expect(render(<TermsGate />)).toBe('');
  });
});
