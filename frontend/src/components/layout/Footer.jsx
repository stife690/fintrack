import { Link } from 'react-router-dom';
import { ArrowUp, Play } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { useTour } from '@/components/home/tour/GuidedTour';
import useApiHealth from '@/hooks/useApiHealth';
import { cn } from '@/lib/utils';

const COLUMNS = [
  {
    title: 'Producto',
    links: [
      { href: '#funcionalidades', label: 'Funcionalidades' },
      { href: '#alertas', label: 'Alertas' },
      { href: '#app', label: 'App instalable' },
      { href: '#seguridad', label: 'Seguridad' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { href: '#como-funciona', label: 'Cómo funciona' },
      { href: '#faq', label: 'Preguntas frecuentes' },
      { tour: true, label: 'Escuchar el recorrido' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/terminos', label: 'Términos de uso' },
      { to: '/privacidad', label: 'Política de privacidad' },
    ],
  },
  {
    title: 'Cuenta',
    links: [
      { to: '/login', label: 'Iniciar sesión' },
      { to: '/registro', label: 'Crear cuenta' },
    ],
  },
];

const STATUS_LABEL = { loading: 'Verificando API…', ok: 'API operativa', error: 'API sin conexión' };
const STATUS_DOT = { loading: 'bg-white/40 animate-pulse', ok: 'bg-success', error: 'bg-destructive' };

/** Enlace del pie: gris que se pone blanco y se corre un poco a la derecha. */
const LINK = 'inline-flex items-center gap-2 text-white/65 transition-[color,transform] duration-200 hover:translate-x-0.5 hover:text-white';

/**
 * Pie de página: marca y tres columnas de enlaces, la línea final con el estado de `GET /health`
 * y "Volver arriba", y el nombre FinTrack en violeta cortado por el borde inferior como cierre.
 */
export default function Footer() {
  const apiStatus = useApiHealth();
  const tour = useTour();

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="relative overflow-hidden bg-[linear-gradient(to_bottom,#6142ff,#000_10rem)] pt-16 text-white">
      <div className="container-page relative grid grid-cols-2 gap-x-6 gap-y-12 py-16 md:grid-cols-[1.5fr_repeat(4,1fr)] md:py-20">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Logo />
          <p className="mt-4 text-white/65">
            Registra tus gastos, controla tu presupuesto y sincroniza tus datos, incluso sin conexión.
          </p>
          <p className="mt-6 text-sm text-white/40">Proyecto académico · Universidad Surcolombiana</p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-5 text-sm font-medium text-orchid">{col.title}</h3>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.to && (
                    <Link to={link.to} className={LINK}>
                      {link.label}
                    </Link>
                  )}
                  {link.href && (
                    <a href={link.href} className={LINK}>
                      {link.label}
                    </a>
                  )}
                  {link.tour && (
                    <button type="button" onClick={tour.start} className={cn(LINK, 'text-left')}>
                      <span className="grid size-5 place-items-center rounded-full bg-violet text-white">
                        <Play className="size-2.5 translate-x-px" aria-hidden="true" />
                      </span>
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container-page relative flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} FinTrack</p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5" role="status">
            <span className={cn('size-2 rounded-full', STATUS_DOT[apiStatus])} />
            {STATUS_LABEL[apiStatus]}
          </p>
          <button
            type="button"
            onClick={toTop}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            Volver arriba
            <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        Cierre: el nombre de la marca a todo el ancho, en violeta que se desvanece hacia abajo y
        cortado por el borde inferior. Es un SVG decorativo (no texto), así no cuenta como texto de
        bajo contraste; `textLength` lo estira justo al ancho del contenedor.
      */}
      <div aria-hidden="true" className="container-page relative mt-4 select-none">
        <svg viewBox="0 0 1000 175" className="block w-full" focusable="false">
          <defs>
            <linearGradient id="footer-wordmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8b66ff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#6142ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <text
            x="0"
            y="235"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fill="url(#footer-wordmark)"
            fontSize="290"
            fontWeight="600"
            letterSpacing="-14"
          >
            FinTrack
          </text>
        </svg>
      </div>
    </footer>
  );
}
