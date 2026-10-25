import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarRange,
  Check,
  ChevronRight,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sheet,
  WifiOff,
} from 'lucide-react';
import { currentMonth, shiftMonth } from '@/components/budgets/month';
import ChipGroup from '@/components/common/ChipGroup';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { downloadFile } from '@/lib/downloadFile';
import { cn } from '@/lib/utils';
import { today } from '@/lib/validation/transaction';
import { exportTransactions } from '@/services/reportService';
import { monthRange } from '@/services/summaryService';

/** Formatos disponibles: qué es cada uno, su ícono y qué trae (para la vista previa). */
const FORMATS = [
  {
    value: 'xlsx',
    label: 'Excel',
    extension: '.xlsx',
    icon: FileSpreadsheet,
    tone: 'bg-emerald-500/12 text-emerald-600',
    summary: 'Reporte con totales y fórmulas',
    includes: [
      'Ingresos, gastos, balance y tasa de ahorro',
      'Gastos e ingresos por categoría',
      'Top 5 de gastos más grandes',
      'Presupuestos del mes y su estado',
      'Todos los movimientos, con filtros',
    ],
  },
  {
    value: 'pdf',
    label: 'PDF',
    extension: '.pdf',
    icon: FileText,
    tone: 'bg-rose-500/12 text-rose-600',
    summary: 'El mismo reporte con gráficos',
    includes: [
      'Indicadores del periodo',
      'Gráficos de categorías y evolución',
      'Top 5 de gastos y presupuestos',
      'Listado completo de movimientos',
      'Listo para imprimir o compartir',
    ],
  },
  {
    value: 'csv',
    label: 'CSV',
    extension: '.csv',
    icon: Sheet,
    tone: 'bg-sky-500/12 text-sky-600',
    summary: 'Solo los datos, en texto plano',
    includes: ['Una fila por movimiento', 'Para importar en otra herramienta', 'Sin formato ni totales'],
  },
];

const PERIOD_OPTIONS = [
  { value: 'this-month', label: 'Este mes' },
  { value: 'last-month', label: 'Mes pasado' },
  { value: 'this-year', label: 'Este año' },
  { value: 'custom', label: 'Otro' },
];

/**
 * Rango de fechas de cada periodo con nombre. "Este año" va del 1 de enero a hoy.
 * @param {string} period
 * @returns {{ from: string, to: string }}
 */
function rangeOf(period) {
  if (period === 'this-month') return monthRange(currentMonth());
  if (period === 'last-month') return monthRange(shiftMonth(currentMonth(), -1));
  return { from: `${today().slice(0, 4)}-01-01`, to: today() };
}

/**
 * `2026-10-01` → `1 de octubre de 2026`, sin pasar por UTC (no se corre un día).
 * @param {string} iso
 * @returns {string}
 */
function longDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Nombre que tendrá el archivo, igual al que arma el servidor: `fintrack_2026-10.xlsx` si es un mes
 * completo; si no, `fintrack_<desde>_<hasta>.xlsx`.
 * @param {{ from: string, to: string }} range
 * @param {string} extension
 * @returns {string}
 */
function previewFilename({ from, to }, extension) {
  const whole = monthRange(from.slice(0, 7));
  const period = whole.from === from && whole.to === to ? from.slice(0, 7) : `${from}_${to}`;
  return `fintrack_${period}${extension}`;
}

/**
 * Círculo de selección de una tarjeta de formato.
 * @param {{ checked: boolean, className?: string }} props
 */
function CheckDot({ checked, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
        checked ? 'border-brand bg-brand text-white' : 'border-ink/25',
        className,
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

/**
 * Tarjetas para elegir el formato. Son radios nativos (flechas del teclado y lector de pantalla).
 * @param {{ value: string, onChange: (value: string) => void }} props
 */
function FormatPicker({ value, onChange }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">Formato del archivo</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {FORMATS.map(({ value: option, label, extension, icon: Icon, tone, summary }) => {
          const checked = value === option;
          return (
            <label
              key={option}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors sm:flex-col sm:items-stretch sm:p-4',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
                checked ? 'border-brand bg-brand-soft/50 ring-1 ring-brand' : 'border-ink/10 hover:border-ink/25',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span className="flex shrink-0 items-center justify-between sm:w-full">
                <span aria-hidden="true" className={cn('grid size-10 place-items-center rounded-xl', tone)}>
                  <Icon className="size-5" />
                </span>
                <CheckDot checked={checked} className="max-sm:hidden" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs text-ink/60">{extension}</span>
                </span>
                <span className="mt-0.5 block text-sm text-ink/60">{summary}</span>
              </span>
              <CheckDot checked={checked} className="sm:hidden" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Título numerado de cada paso (el orden sí importa: primero el formato, luego el periodo).
 * @param {{ number: number, title: string, id: string }} props
 */
function StepTitle({ number, title, id }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-2.5 text-base font-semibold tracking-tight">
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">
        {number}
      </span>
      {title}
    </h2>
  );
}

/**
 * Página privada `/app/transacciones/exportar`: descarga un reporte del periodo en Excel, PDF o CSV
 * (FT-0012). A la izquierda se elige formato y periodo; a la derecha, la vista previa del archivo y
 * el botón de descarga. El archivo lo genera el servidor, así que necesita conexión. Si no hay
 * movimientos en el periodo, lo dice en lugar de descargar un archivo vacío (REQ-033).
 */
export default function Export() {
  usePageTitle('Exportar movimientos');
  const online = useOnlineStatus();
  const [format, setFormat] = useState('xlsx');
  const [period, setPeriod] = useState('this-month');
  const [custom, setCustom] = useState(() => ({ from: `${currentMonth()}-01`, to: today() }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const selected = FORMATS.find((f) => f.value === format);
  const range = useMemo(() => (period === 'custom' ? custom : rangeOf(period)), [period, custom]);
  const rangeError =
    period !== 'custom'
      ? ''
      : !custom.from || !custom.to
        ? 'Elige las dos fechas.'
        : custom.from > custom.to
          ? 'La fecha "Desde" debe ser anterior o igual a "Hasta".'
          : '';
  const rangeText =
    range.from === range.to ? `el ${longDate(range.from)}` : `del ${longDate(range.from)} al ${longDate(range.to)}`;
  const filename = rangeError ? `fintrack${selected.extension}` : previewFilename(range, selected.extension);

  /** Al cambiar cualquier opción se borra el resultado anterior, para no mostrar uno que ya no aplica. */
  const reset = () => {
    setError('');
    setDone('');
  };

  const handleDownload = async () => {
    reset();
    setBusy(true);
    try {
      const result = await exportTransactions({ format, ...range });
      downloadFile(result.blob, result.filename);
      setDone(`Descargado ${result.filename}`);
    } catch (err) {
      setError(err.code === 'NO_DATA' ? `No tienes movimientos ${rangeText}. Prueba con otro periodo.` : err.message);
    } finally {
      setBusy(false);
    }
  };

  const SelectedIcon = selected.icon;

  return (
    <>
      <nav aria-label="Ruta" className="mb-4">
        <ol className="flex items-center gap-1.5 text-sm">
          <li>
            <Link to="/app/transacciones" className="font-medium text-ink/60 transition-colors hover:text-brand">
              Movimientos
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-4 text-ink/30" />
          </li>
          <li aria-current="page" className="font-medium text-ink">
            Exportar
          </li>
        </ol>
      </nav>

      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Exportar movimientos</h1>
        <p className="mt-1 text-ink/60">
          Descarga un reporte de tus gastos e ingresos para analizarlo, imprimirlo o compartirlo.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel aria-labelledby="step-format">
            <StepTitle number={1} title="Elige el formato" id="step-format" />
            <FormatPicker value={format} onChange={(value) => (setFormat(value), reset())} />
          </Panel>

          <Panel aria-labelledby="step-period">
            <StepTitle number={2} title="Elige el periodo" id="step-period" />
            <ChipGroup
              legend="Periodo"
              hideLegend
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(value) => (setPeriod(value), reset())}
            />
            {period === 'custom' && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="export-from">Desde</Label>
                  <Input
                    id="export-from"
                    type="date"
                    value={custom.from}
                    max={custom.to || undefined}
                    onChange={(e) => (setCustom((c) => ({ ...c, from: e.target.value })), reset())}
                    aria-invalid={rangeError ? true : undefined}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="export-to">Hasta</Label>
                  <Input
                    id="export-to"
                    type="date"
                    value={custom.to}
                    min={custom.from || undefined}
                    onChange={(e) => (setCustom((c) => ({ ...c, to: e.target.value })), reset())}
                    aria-invalid={rangeError ? true : undefined}
                  />
                </div>
              </div>
            )}
            <p className={cn('mt-4 flex items-start gap-2 text-sm', rangeError ? 'text-negative' : 'text-ink/60')}>
              <CalendarRange className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {rangeError || <span>Incluye tus movimientos {rangeText}.</span>}
            </p>
          </Panel>
        </div>

        <aside aria-labelledby="preview-title" className="min-w-0">
          <Panel className="flex flex-col gap-5 lg:sticky lg:top-8">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', selected.tone)}>
                <SelectedIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 id="preview-title" className="text-sm font-medium text-ink/60">
                  Tu reporte
                </h2>
                <p className="truncate font-semibold" title={filename}>
                  {filename}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Incluye</p>
              <ul className="space-y-2">
                {selected.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink/70">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 border-t border-ink/10 pt-5">
              <Button
                size="lg"
                className="w-full"
                onClick={handleDownload}
                disabled={busy || !online || Boolean(rangeError)}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                {busy ? 'Preparando archivo…' : `Descargar ${selected.label}`}
              </Button>

              {!online && (
                <p className="flex items-start gap-2 text-sm text-caution">
                  <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Necesitas conexión para exportar: el archivo se genera en el servidor.
                </p>
              )}
              <p role="status" className="text-sm text-positive">
                {done && (
                  <span className="flex items-start gap-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {done}
                  </span>
                )}
              </p>
              {error && (
                <p role="alert" className="text-sm text-negative">
                  {error}
                </p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
