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
      { href: '#testimonios', label: 'Testimonios' },
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
      <img
        src="/images/common/footer-pattern.svg"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute -right-24 -top-10 w-[420px] opacity-20 md:w-[520px]"
      />

      <div className="container-page relative grid gap-12 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)] md:py-20">
        <div className="max-w-xs space-y-4">
          <Logo />
          <p className="text-white/55">
            Registra tus gastos, controla tu presupuesto y sincroniza tus datos, incluso sin conexión.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-4 font-medium text-white">{col.title}</h3>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link to={link.to} className="text-white/55 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-white/55 transition-colors hover:text-white">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container-page relative flex flex-col gap-3 border-t border-white/10 py-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} FinTrack. Proyecto académico.</p>
        <p className="inline-flex items-center gap-2" role="status">
          <span className={cn('size-2 rounded-full', STATUS_DOT[apiStatus])} />
          {STATUS_LABEL[apiStatus]}
        </p>
      </div>
    </footer>
  );
}
