import { CalendarDays, ExternalLink, FileSearch, Lock } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import usePageTitle from '@/hooks/usePageTitle';

/**
 * Páginas oficiales de la DIAN. Son las que no cambian de un año a otro: FinTrack no muestra topes
 * ni fechas, que cambian cada año y solo la DIAN mantiene al día.
 */
export const DIAN_LINKS = [
  {
    title: '¿Debo declarar renta?',
    detail: 'Consulta tu caso en el servicio oficial de la DIAN.',
    label: 'Consultar en la DIAN',
    href: 'https://consultarenta.dian.gov.co/',
    icon: FileSearch,
  },
  {
    title: '¿Qué día me toca?',
    detail: 'Las fechas dependen de los últimos dígitos de tu documento.',
    label: 'Ver el calendario tributario',
    href: 'https://www.dian.gov.co/Paginas/CalendarioTributario.aspx',
    icon: CalendarDays,
  },
];

/** Página privada `/app/renta`: lleva a los servicios oficiales de la DIAN para la declaración de renta. */
export default function Renta() {
  usePageTitle('Renta y DIAN');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Renta y DIAN" description="Averigua si te toca declarar y cuándo." />

      <div className="flex flex-col gap-5">
        {DIAN_LINKS.map(({ title, detail, label, href, icon: Icon }) => (
          <Panel key={href}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                <p className="mt-1 text-sm text-ink/60">{detail}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <a href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {label}
                <span className="sr-only"> (abre la página de la DIAN)</span>
              </a>
            </Button>
          </Panel>
        ))}

        <p className="flex items-start gap-2 px-1 text-sm text-ink/60">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Tu documento lo escribes en la página de la DIAN, nunca en FinTrack. Esta guía no reemplaza a un contador.
        </p>
      </div>
    </div>
  );
}
