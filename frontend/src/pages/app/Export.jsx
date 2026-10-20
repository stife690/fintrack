import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Download, FileSpreadsheet, FileText, Loader2, WifiOff } from 'lucide-react';
import { currentMonth, shiftMonth } from '@/components/budgets/month';
import ChipGroup from '@/components/common/ChipGroup';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { downloadFile } from '@/lib/downloadFile';
import { today } from '@/lib/validation/transaction';
import { exportTransactions } from '@/services/reportService';
import { monthRange } from '@/services/summaryService';

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV (Excel)', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileText, disabled: true, badge: 'Próximamente' },
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

/** `2026-10-01` → `1 de octubre de 2026`, sin pasar por UTC (no se corre un día). */
function longDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Página privada `/app/transacciones/exportar`: descarga los movimientos de un periodo en un archivo (FT-0012).
 * El archivo lo genera el servidor (`GET /reports/export`), así que necesita conexión.
 * Si no hay movimientos en el periodo, lo dice en lugar de descargar un archivo vacío (REQ-033).
 */
export default function Export() {
  usePageTitle('Exportar movimientos');
  const online = useOnlineStatus();
  const [format, setFormat] = useState('csv');
  const [period, setPeriod] = useState('this-month');
  const [custom, setCustom] = useState(() => ({ from: `${currentMonth()}-01`, to: today() }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

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

  /** Al cambiar cualquier opción se borra el resultado anterior, para no mostrar uno que ya no aplica. */
  const reset = () => {
    setError('');
    setDone('');
  };

  const handleDownload = async () => {
    reset();
    setBusy(true);
    try {
      const { blob, filename } = await exportTransactions({ format, ...range });
      downloadFile(blob, filename);
      setDone(`Descargado ${filename}`);
    } catch (err) {
      setError(
        err.code === 'NO_DATA'
          ? `No tienes movimientos ${rangeText}. Prueba con otro periodo.`
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/transacciones"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Movimientos
      </Link>
      <PageHeader
        title="Exportar movimientos"
        description="Descarga tus gastos e ingresos en un archivo para abrirlo en Excel o Google Sheets."
      />

      <Panel className="flex flex-col gap-6">
        <ChipGroup
          legend="Formato"
          options={FORMAT_OPTIONS}
          value={format}
          onChange={(value) => (setFormat(value), reset())}
        />

        <div className="flex flex-col gap-3">
          <ChipGroup
            legend="Periodo"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(value) => (setPeriod(value), reset())}
          />
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
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
        </div>

        <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/70">
          {rangeError ? (
            <span className="text-negative">{rangeError}</span>
          ) : (
            <>
              Se exportarán tus movimientos <strong className="font-medium text-ink">{rangeText}</strong>.
            </>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="sm:self-start"
            onClick={handleDownload}
            disabled={busy || !online || Boolean(rangeError)}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {busy ? 'Preparando archivo…' : `Descargar ${format.toUpperCase()}`}
          </Button>

          {!online && (
            <p className="flex items-center gap-2 text-sm text-caution">
              <WifiOff className="size-4 shrink-0" aria-hidden="true" />
              Necesitas conexión para exportar: el archivo se genera en el servidor.
            </p>
          )}
          <p role="status" className="text-sm text-positive">
            {done && (
              <span className="inline-flex items-center gap-1.5">
                <CircleCheck className="size-4" aria-hidden="true" />
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
    </div>
  );
}
