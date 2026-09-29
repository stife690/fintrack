import { Component } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from './Logo';

/** Errores típicos de un `import()` dinámico que no se pudo descargar. */
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk/i;

/*
 * El navegador (y React.lazy) guardan en caché un import() fallido durante toda la vida
 * de la página: aunque vuelva la conexión, navegar a esa ruta sigue fallando. Solo una
 * recarga completa lo resuelve, así que se deja la marca para que App recargue al navegar.
 */
let chunkFailed = false;

/** @returns {boolean} true si algún chunk diferido falló al cargar en esta página. */
export const hasChunkFailed = () => chunkFailed;

/**
 * Atrapa errores de render de sus hijos (incluido un chunk diferido que no carga,
 * p. ej. sin conexión) y muestra una pantalla con opción de reintentar en vez de
 * dejar la app en blanco.
 *
 * No atrapa errores en eventos, promesas ni `setTimeout`: esos se manejan con try/catch.
 * Para limpiar el error al navegar, se monta con `key={pathname}`.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (CHUNK_ERROR.test(error.message ?? '')) chunkFailed = true;
    console.error('Error de render:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError = CHUNK_ERROR.test(error.message ?? '');

    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black p-4 text-center text-white"
        role="alert"
      >
        <Logo />
        <h1 className="text-3xl font-semibold tracking-tight">Algo salió mal</h1>
        <p className="max-w-sm text-white/60">
          {isChunkError
            ? 'No pudimos cargar esta sección. Revisa tu conexión e inténtalo de nuevo.'
            : 'Ocurrió un error inesperado. Intenta recargar la página.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
          {/* Link (no <a>): navega sin recargar, así funciona sin conexión; el key del boundary lo resetea. */}
          <Button asChild variant="outline" size="lg">
            <Link to="/">Ir al inicio</Link>
          </Button>
        </div>
      </main>
    );
  }
}
