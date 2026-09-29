import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/common/Logo';

/**
 * Estructura común de login y registro: fondo negro, columna centrada de 400px
 * (como las pantallas de auth de la plantilla) y un brillo violeta de fondo.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer] Texto bajo el formulario (p. ej. enlace a la otra pantalla).
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-violet/20 blur-[140px]"
      />

      <header className="container-page relative flex h-20 items-center justify-between">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>
            Volver<span className="hidden sm:inline"> al inicio</span>
          </span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          className="w-full max-w-[400px] space-y-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="space-y-2 text-center">
            <h1 className="text-balance text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-white/55">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="text-center text-sm">{footer}</div>}
        </motion.div>
      </main>
    </div>
  );
}
