import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/common/Logo';
import usePageTitle from '@/hooks/usePageTitle';
import { CONTACT_EMAIL, LEGAL_VERSION } from './legalContent';

const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Fecha de la versión para leer, p. ej. "5 de noviembre de 2026".
 * @param {string} version AAAA-MM-DD
 * @returns {string}
 */
export function versionDate(version) {
  const [y, m, d] = version.split('-').map(Number);
  return date.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Página pública de un documento legal (términos o privacidad): título, fecha de la versión,
 * secciones y el enlace al otro documento. Se lee sin sesión.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {import('./legalContent').LegalSection[]} props.sections
 * @param {{ to: string, label: string }} props.other Enlace al otro documento.
 */
export default function LegalPage({ title, sections, other }) {
  usePageTitle(title);
  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="container-page flex items-center justify-between gap-4 py-6">
        <Link to="/" aria-label="FinTrack, ir al inicio">
          <Logo />
        </Link>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="size-4" aria-hidden="true" /> Volver
        </Link>
      </header>

      <main className="container-page max-w-3xl pb-20 pt-6">
        <h1 className="break-words text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-2 text-white/55">Versión vigente desde el {versionDate(LEGAL_VERSION)}.</p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={slug(section.title)}>
              <h2 id={slug(section.title)} className="text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              {section.paragraphs?.map((text) => (
                <p key={text} className="mt-3 leading-relaxed text-white/75">
                  {text}
                </p>
              ))}
              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-white/75 marker:text-violet-light">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-words">
            ¿Preguntas? Escríbenos a{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-light underline-offset-4 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
          <Link to={other.to} className="text-violet-light underline-offset-4 hover:underline">
            {other.label}
          </Link>
        </footer>
      </main>
    </div>
  );
}

/**
 * @param {string} title
 * @returns {string} Id para el ancla de la sección.
 */
function slug(title) {
  return `s-${title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}
