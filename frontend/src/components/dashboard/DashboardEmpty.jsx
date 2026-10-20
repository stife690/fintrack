import { Link } from 'react-router-dom';
import { ChartPie, Minus, Plus, Target, Wallet } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';

/** Lo que el usuario verá en el inicio cuando empiece a registrar. */
const PREVIEW = [
  { icon: Wallet, title: 'Tu balance', text: 'Ingresos, gastos y lo que te queda en la semana, el mes o el año.' },
  { icon: ChartPie, title: 'En qué gastas', text: 'Gráficos por categoría; la IA clasifica cada gasto por ti.' },
  { icon: Target, title: 'Tus límites', text: 'Avisos cuando un presupuesto llega al 80 % o al 100 %.' },
];

/**
 * Estado vacío del inicio (FT-0004): se muestra en lugar del balance y los gráficos
 * cuando el usuario todavía no tiene ningún movimiento, para invitarlo a registrar el primero.
 */
export default function DashboardEmpty() {
  return (
    <Panel aria-labelledby="empty-title" className="text-center md:p-10">
      <span
        aria-hidden="true"
        className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"
      >
        <Wallet className="size-7" />
      </span>
      <h2 id="empty-title" className="mt-5 text-xl font-semibold tracking-tight md:text-2xl">
        Registra tu primer movimiento
      </h2>
      <p className="mx-auto mt-2 max-w-md text-ink/60">
        Aún no tienes gastos ni ingresos. Apenas registres el primero, aquí verás cómo van tus finanzas.
      </p>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/app/transacciones?nuevo=gasto">
            <Minus aria-hidden="true" />
            Registrar un gasto
          </Link>
        </Button>
        <Button asChild variant="soft">
          <Link to="/app/transacciones?nuevo=ingreso">
            <Plus aria-hidden="true" />
            Registrar un ingreso
          </Link>
        </Button>
      </div>

      <ul className="mt-8 grid gap-4 border-t border-ink/10 pt-6 text-left sm:grid-cols-3">
        {PREVIEW.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
            <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-ink/60">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
