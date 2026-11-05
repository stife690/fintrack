import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Enlaces a las secciones de la landing. */
const NAV_LINKS = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#app', label: 'App' },
  { href: '#seguridad', label: 'Seguridad' },
  { href: '#faq', label: 'FAQ' },
];

/**
 * Barra de navegación fija y oscura. Se vuelve translúcida al hacer scroll
 * y en móvil abre un panel desplegable (hamburguesa), como en la plantilla.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={cn(
        // pt-safe: en el iPhone la página se dibuja bajo la hora y la batería (viewport-fit=cover);
        // ese relleno baja la barra justo debajo, y el fondo la cubre para que no se vea borrosa.
        'fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300',
        scrolled || open ? 'bg-black/85 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-lg' : 'bg-transparent',
      )}
    >
      <nav
        className="container-page flex h-20 items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]"
        aria-label="Principal"
      >
        <Logo />

        <ul className="hidden items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="block rounded-full px-4 py-2 text-[15px] text-white/75 transition-colors hover:bg-white/10 hover:text-white">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center justify-end gap-2 lg:flex">
          <Button asChild variant="ghost">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button
            asChild
            className="rounded-full px-5 motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
          >
            <Link to="/registro">Crear cuenta</Link>
          </Button>
        </div>

        {/* En móvil, "Iniciar sesión" queda siempre a la vista junto al menú. */}
        <div className="flex items-center gap-1 lg:hidden">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full border border-white/15 px-3.5 text-white hover:bg-white/10 hover:text-white motion-safe:transition-[color,background-color,transform] motion-safe:active:scale-[0.97]"
          >
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="[&_svg]:size-6"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="h-[calc(100dvh-5rem-env(safe-area-inset-top))] overflow-y-auto border-t border-white/10 bg-black lg:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ul className="container-page flex flex-col gap-1 py-6">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-2 py-3 text-xl text-white/85 hover:bg-white/5 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="container-page flex flex-col gap-3 pb-8">
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild size="lg">
                <Link to="/registro">Crear cuenta</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
