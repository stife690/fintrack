import { Link } from 'react-router-dom';
import { ChevronRight, Wallet } from 'lucide-react';
import Panel from '@/components/layout/Panel';

/**
 * Acceso a Mi plata para quien omitió la bienvenida o no la respondió completa: sin esto, nada en
 * el inicio le dice dónde configurarlo. No se puede cerrar, pero ocupa una sola línea.
 */
export default function MoneySetupLink() {
  return (
    <Panel className="p-0 md:p-0">
      <Link
        to="/app/mi-plata"
        className="flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <Wallet className="size-5 shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-medium">Configura Mi plata</span>
          <span className="block text-ink/60">Dinos cómo te entra la plata y te calculamos cuánto puedes gastar.</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
      </Link>
    </Panel>
  );
}
