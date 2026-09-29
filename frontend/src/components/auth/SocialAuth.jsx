import { Button } from '@/components/ui/button';

/** Logo oficial de Google en SVG. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

/**
 * Separador "o" + botón "Continuar con Google" deshabilitado (aún no hay login social).
 * Se mantiene para respetar el diseño de la plantilla.
 */
export default function SocialAuth() {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-white/45">o</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Button type="button" variant="outline" size="lg" className="w-full text-base" disabled aria-describedby="google-soon">
        <GoogleIcon />
        Continuar con Google
        <span id="google-soon" className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
          Próximamente
        </span>
      </Button>
    </>
  );
}
