import { Check, Info, Sparkles } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import usePageTitle from '@/hooks/usePageTitle';

/** Precios de ejemplo de la beta: nada de esta pantalla se cobra todavía. */
export const PRO_MONTHLY = 9000;
export const PRO_YEARLY = 79000;

const FREE_FEATURES = [
  'Movimientos y presupuestos',
  'Insights y salud financiera',
  'Vacas y negocios',
  'Registro por voz y sin conexión',
];

const PRO_IDEAS = ['Todo lo del plan Gratis', 'Registro por WhatsApp', 'Metas de ahorro personales', 'Alertas de gastos inusuales'];

/**
 * Precio en pesos, sin decimales.
 * @param {number} value
 * @returns {string}
 */
export function formatPrice(value) {
  return `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)}`;
}

/**
 * Cuánto se ahorra al pagar el año frente a doce meses, en porcentaje entero.
 * @param {number} monthly
 * @param {number} yearly
 * @returns {number}
 */
export function yearlySavings(monthly, yearly) {
  return Math.round((1 - yearly / (monthly * 12)) * 100);
}

function FeatureList({ items }) {
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Página privada `/app/planes`: los planes como ejemplo, para que se vea hacia dónde va FinTrack.
 * No tiene botón de pago: durante la beta no se cobra nada.
 */
export default function Plans() {
  usePageTitle('Planes');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Planes" description="Así podrían verse cuando FinTrack salga de la beta." />

      <p className="mb-5 flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Beta: aún no se cobra nada. Los precios y lo que incluye cada plan son ejemplos y pueden cambiar.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel aria-labelledby="plan-gratis">
          <h2 id="plan-gratis" className="text-lg font-semibold tracking-tight">
            Gratis
          </h2>
          <p className="mt-2 text-2xl font-semibold tracking-tight">$ 0</p>
          <p className="mt-1 text-sm text-ink/60">Lo que ya usas hoy.</p>
          <FeatureList items={FREE_FEATURES} />
        </Panel>

        <Panel aria-labelledby="plan-pro">
          <h2 id="plan-pro" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            Pro
          </h2>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {formatPrice(PRO_MONTHLY)} <span className="text-sm font-normal text-ink/60">al mes</span>
          </p>
          <p className="mt-1 text-sm text-ink/60">
            O {formatPrice(PRO_YEARLY)} al año: ahorras {yearlySavings(PRO_MONTHLY, PRO_YEARLY)} %.
          </p>
          <FeatureList items={PRO_IDEAS} />
          <p className="mt-3 text-xs text-ink/60">Lo nuevo de este plan aún no existe: son ideas.</p>
        </Panel>
      </div>
    </div>
  );
}
