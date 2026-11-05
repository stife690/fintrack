import { Link } from 'react-router-dom';
import Logo from '@/components/common/Logo';
import useApiHealth from '@/hooks/useApiHealth';
import { cn } from '@/lib/utils';

const COLUMNS = [
  {
    title: 'Producto',
    links: [
      { href: '#funcionalidades', label: 'Funcionalidades' },
      { href: '#app', label: 'App instalable' },
      { href: '#seguridad', label: 'Seguridad' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { href: '#faq', label: 'Preguntas frecuentes' },
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

/**
 * Pie de página oscuro con el patrón de cuadros de la plantilla.
 * Muestra el estado de `GET /health` del backend (antes era el hello world).
 */
export default function Footer() {
  const apiStatus = useApiHealth();

  return (
    <footer className="relative overflow-hidden bg-black text-white">
      <div className="container-page relative grid grid-cols-2 gap-x-6 gap-y-12 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)] md:py-24">
        <div className="col-span-2 max-w-xs space-y-4 md:col-span-1">
          <Logo />
          <p className="text-white/65">
            Registra tus gastos, controla tu presupuesto y sincroniza tus datos, incluso sin conexión.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 text-sm font-medium text-orchid">{col.title}</h3>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link to={link.to} className="text-white/70 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-white/70 transition-colors hover:text-white">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/*
        Cierre: el nombre de la marca a todo el ancho. Es un SVG decorativo (no texto), así no
        cuenta como texto de bajo contraste; `textLength` lo estira justo al ancho del contenedor.
      */}
      <div aria-hidden="true" className="container-page relative select-none">
        <svg viewBox="0 0 1000 230" className="block w-full" focusable="false">
          <text
            x="0"
            y="200"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fill="rgba(255,255,255,0.07)"
            fontSize="290"
            fontWeight="600"
            letterSpacing="-14"
          >
            FinTrack
          </text>
        </svg>
      </div>

      <div className="container-page relative flex flex-col gap-3 border-t border-white/10 py-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} FinTrack. Proyecto académico.</p>
        <p className="inline-flex items-center gap-2" role="status">
          <span className={cn('size-2 rounded-full', STATUS_DOT[apiStatus])} />
          {STATUS_LABEL[apiStatus]}
        </p>
      </div>
    </footer>
  );
}
