import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Renta, { DIAN_LINKS } from '@/pages/app/Renta';

describe('Renta', () => {
  it('solo enlaza a sitios oficiales de la DIAN, con https', () => {
    for (const { href } of DIAN_LINKS) expect(new URL(href).hostname).toMatch(/(^|\.)dian\.gov\.co$/);
    expect(DIAN_LINKS.every(({ href }) => href.startsWith('https://'))).toBe(true);
  });

  it('abre cada enlace en otra pestaña, sin darle acceso a la app', () => {
    const html = renderToStaticMarkup(<Renta />);
    expect(html.match(/target="_blank"/g)).toHaveLength(DIAN_LINKS.length);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(DIAN_LINKS.length);
  });

  it('no pide el documento dentro de FinTrack', () => {
    expect(renderToStaticMarkup(<Renta />)).not.toContain('<input');
  });
});
