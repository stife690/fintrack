import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Plus, Trash2, Undo2 } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import Panel from '@/components/layout/Panel';
import BusinessDistribution, { WithdrawalForm } from '@/components/negocios/BusinessDistribution';
import MovementForm from '@/components/negocios/MovementForm';
import { BUSINESS_CATEGORIES, MOVEMENT_KINDS, changeText, monthLabel, shiftMonth } from '@/components/negocios/movementFormat';
import { formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { downloadFile } from '@/lib/downloadFile';
import { cn } from '@/lib/utils';
import { createMovement, deleteMovement, exportBusinessMonth, listMovements, withdraw } from '@/services/negocioService';

/**
 * Hoja "Exportar el mes": Excel o PDF para el contador (FT-0018).
 * @param {{ onExport: (format: 'xlsx'|'pdf') => Promise<void>, disabled: boolean }} props
 */
function ExportOptions({ onExport, disabled }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const run = async (format) => {
    setBusy(format);
    setError('');
    try {
      await onExport(format);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        Estado de resultados, punto de equilibrio, reparto entre socios y todos los movimientos con quién los registró.
      </p>
      <Button
        variant="outline"
        size="lg"
        className="w-full justify-start"
        onClick={() => run('xlsx')}
        disabled={disabled || busy}
      >
        {busy === 'xlsx' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
        Excel (.xlsx)
      </Button>
      <Button variant="outline" size="lg" className="w-full justify-start" onClick={() => run('pdf')} disabled={disabled || busy}>
        {busy === 'pdf' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
        PDF
      </Button>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

const percent = (n) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;

/** Una cifra del resumen. */
function Stat({ label, value, tone, note }) {
  return (
    <Panel>
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className={cn('mt-1 text-xl font-semibold tabular-nums md:text-2xl', tone)}>{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-ink/60">{note}</dd>}
    </Panel>
  );
}

/** Fila del estado de resultados: `sign` es +, − o = . */
function Line({ sign, label, value, strong }) {
  return (
    <div
      className={cn('flex items-baseline justify-between gap-3 py-1.5', strong && 'border-t border-ink/10 pt-2 font-semibold')}
    >
      <dt className={cn(!strong && 'text-ink/70')}>
        <span aria-hidden="true" className="inline-block w-4 text-ink/40">
          {sign}
        </span>
        {label}
      </dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

/** Cuánto hay que vender para no perder y cuánto se lleva. */
function BreakEven({ panel }) {
  if (panel.breakEven === null) {
    return (
      <p className="text-sm text-ink/60">
        {panel.fixed === 0
          ? 'Registra tus gastos fijos (arriendo, nómina…) para saber cuánto necesitas vender para no perder.'
          : 'Con lo registrado, vender no alcanza a cubrir el costo de lo que vendes: revisa precios o costos.'}
      </p>
    );
  }
  const progress = Math.min(100, Math.round((panel.sale / panel.breakEven) * 100));
  return (
    <div className="space-y-2">
      <p>
        Para no perder este mes necesitas vender{' '}
        <span className="font-semibold tabular-nums">{formatMoney(panel.breakEven)}</span>.
      </p>
      <div
        role="progressbar"
        aria-label="Avance hacia el punto de equilibrio"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className={cn('h-full rounded-full', panel.breakEvenReached ? 'bg-positive' : 'bg-brand')}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-ink/60">
        {panel.breakEvenReached
          ? `Ya lo pasaste: llevas ${formatMoney(panel.sale)} en ventas.`
          : `Llevas ${formatMoney(panel.sale)} (${progress} %). Cada peso que vendes deja ${percent(panel.contributionMargin)} para los fijos.`}
      </p>
    </div>
  );
}

/** Entradas y salidas por semana del mes. */
function CashFlow({ weeks }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.in, w.out]));
  return (
    <ul className="space-y-3">
      {weeks.map((w) => (
        <li key={w.label} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-ink/60">{w.label}</span>
          <span className="space-y-1" aria-hidden="true">
            <span className="block h-1.5 rounded-full bg-positive" style={{ width: `${(w.in / max) * 100}%` }} />
            <span className="block h-1.5 rounded-full bg-negative" style={{ width: `${(w.out / max) * 100}%` }} />
          </span>
          <span className={cn('tabular-nums font-medium', w.net < 0 ? 'text-negative' : w.net > 0 && 'text-positive')}>
            <span className="sr-only">
              Entró {formatMoney(w.in)}, salió {formatMoney(w.out)}, quedó{' '}
            </span>
            {formatMoney(w.net)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Un movimiento de la lista. */
function MovementRow({ movement, onOpen }) {
  const kind = MOVEMENT_KINDS[movement.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4 text-left transition-colors hover:border-ink/20 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium">{movement.description}</span>
          <span className="block text-sm text-ink/60">
            {kind.label} · {BUSINESS_CATEGORIES[movement.category]} · {formatRelativeDay(movement.date)}
          </span>
        </span>
        <span className={cn('shrink-0 font-semibold tabular-nums', kind.income ? 'text-positive' : 'text-ink')}>
          {kind.income ? '+' : '−'}
          {formatMoney(movement.amount)}
        </span>
      </button>
    </li>
  );
}

/**
 * Finanzas del negocio en un mes (FT-0017 y FT-0018): resumen, estado de resultados, punto de
 * equilibrio, reparto entre socios, flujo por semana y movimientos; además, exportar el mes. Los
 * lectores ven y exportan, pero no registran, no retiran ni borran.
 * @param {{ businessId: string, businessName: string, myRole: 'dueno'|'editor'|'lector', myId: string, online: boolean }} props
 */
export default function BusinessMonth({ businessId, businessName, myRole, myId, online }) {
  const today = todayIso();
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // 'nuevo' | 'exportar' | { withdraw: monto sugerido } | movimiento abierto
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    listMovements(businessId, month)
      .then((res) => !cancelled && (setData(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [businessId, month, version]);

  const handleCreate = async (values) => {
    const movement = await createMovement(businessId, values);
    setSheet(null);
    setNotice(`Registrado: ${movement.description}.`);
    if (movement.date.slice(0, 7) !== month) setMonth(movement.date.slice(0, 7));
    else reload();
  };
  const handleDelete = async () => {
    const wasWithdrawal = sheet.kind === 'withdrawal';
    await deleteMovement(businessId, sheet.id);
    setSheet(null);
    setNotice(wasWithdrawal ? 'Retiro deshecho: también se quitó de tus movimientos.' : 'Movimiento borrado.');
    reload();
  };
  const handleWithdraw = async (values) => {
    const { movement } = await withdraw(businessId, values);
    setSheet(null);
    setNotice(`Retiro registrado. Ya está como ingreso en tus movimientos.`);
    if (movement.date.slice(0, 7) !== month) setMonth(movement.date.slice(0, 7));
    else reload();
  };
  const handleExport = async (format) => {
    const { blob, filename } = await exportBusinessMonth(businessId, { month, format });
    downloadFile(blob, filename);
    setSheet(null);
  };

  const panel = data?.panel;
  const prevLabel = panel && monthLabel(panel.previous.month, currentMonth);
  const opened = sheet && typeof sheet === 'object' && 'id' in sheet ? sheet : null;
  const isMine = opened?.registeredBy?.id === myId;
  const isWithdrawal = opened?.kind === 'withdrawal';
  // Un retiro toca las finanzas personales de quien lo hizo: solo esa persona lo deshace.
  const canDelete = opened && data?.canRecord && (isWithdrawal ? isMine : myRole === 'dueno' || isMine);

  return (
    <section aria-labelledby="finanzas-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 id="finanzas-title" className="min-w-32 text-center text-lg font-semibold capitalize tracking-tight">
            {monthLabel(month, currentMonth)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= currentMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div className="flex gap-2">
          {data && (
            <Button variant="outline" onClick={() => setSheet('exportar')} disabled={!online}>
              <Download aria-hidden="true" /> Exportar
            </Button>
          )}
          {data?.canRecord && (
            <Button onClick={() => (setNotice(''), setSheet('nuevo'))} disabled={!online}>
              <Plus aria-hidden="true" /> Registrar
            </Button>
          )}
        </div>
      </div>

      <p role="status" className={cn('text-sm text-positive', !notice && 'sr-only')}>
        {notice}
      </p>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            Reintentar
          </button>
        </p>
      )}
      {!data && !error && (
        <p className="flex items-center gap-2 py-6 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}

      {data && (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Ventas" value={formatMoney(panel.sale)} note={changeText(panel.previous.saleChange, prevLabel)} />
            <Stat
              label="Utilidad"
              value={formatMoney(panel.netProfit)}
              tone={panel.netProfit > 0 ? 'text-positive' : panel.netProfit < 0 ? 'text-negative' : 'text-ink/50'}
              note={panel.netMargin === null ? null : `Margen ${percent(panel.netMargin)}`}
            />
          </dl>

          {data.movements.length === 0 ? (
            <Panel className="text-center">
              <p className="mx-auto max-w-md text-ink/60">
                {data.canRecord
                  ? `No hay movimientos en ${monthLabel(month, currentMonth)}. Registra tus ventas y gastos para ver la utilidad y cuánto necesitas vender.`
                  : `No hay movimientos en ${monthLabel(month, currentMonth)}.`}
              </p>
            </Panel>
          ) : (
            <>
              <Panel aria-labelledby="resultados-title">
                <h3 id="resultados-title" className="mb-2 font-semibold">
                  Cómo te fue
                </h3>
                <dl className="text-sm">
                  <Line sign="" label="Ventas" value={panel.sale} />
                  <Line sign="−" label="Costo de venta" value={panel.cost} />
                  <Line sign="=" label="Utilidad bruta" value={panel.grossProfit} strong />
                  <Line sign="−" label="Gastos variables" value={panel.variable} />
                  <Line sign="−" label="Gastos fijos" value={panel.fixed} />
                  {panel.otherIncome > 0 && <Line sign="+" label="Otros ingresos" value={panel.otherIncome} />}
                  <Line sign="=" label="Utilidad neta" value={panel.netProfit} strong />
                  {panel.withdrawal > 0 && (
                    <>
                      <Line sign="−" label="Retiros de socios" value={panel.withdrawal} />
                      <Line sign="=" label="Quedó en el negocio" value={panel.retained} strong />
                    </>
                  )}
                </dl>
              </Panel>

              <BusinessDistribution
                distribution={data.distribution}
                myId={myId}
                canWithdraw={data.canRecord}
                online={online}
                onWithdraw={(suggested) => (setNotice(''), setSheet({ withdraw: suggested }))}
              />

              <Panel aria-labelledby="equilibrio-title">
                <h3 id="equilibrio-title" className="mb-2 font-semibold">
                  Punto de equilibrio
                </h3>
                <BreakEven panel={panel} />
              </Panel>

              <Panel aria-labelledby="flujo-title">
                <h3 id="flujo-title" className="font-semibold">
                  Flujo de caja por semana
                </h3>
                <p className="mb-3 text-sm text-ink/60">Verde lo que entró, rojo lo que salió; a la derecha lo que quedó.</p>
                <CashFlow weeks={panel.cashFlow} />
              </Panel>

              <div>
                <h3 className="mb-2 text-sm font-medium text-ink/60">Movimientos ({data.movements.length})</h3>
                <ul aria-label="Movimientos del negocio" className="space-y-2">
                  {data.movements.map((m) => (
                    <MovementRow key={m.id} movement={m} onOpen={() => setSheet(m)} />
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}

      <Sheet open={sheet === 'nuevo'} title="Registrar en el negocio" onClose={() => setSheet(null)}>
        {sheet === 'nuevo' && <MovementForm today={today} disabled={!online} onSubmit={handleCreate} />}
      </Sheet>
      <Sheet open={sheet === 'exportar'} title={`Exportar ${monthLabel(month, currentMonth)}`} onClose={() => setSheet(null)}>
        {sheet === 'exportar' && <ExportOptions onExport={handleExport} disabled={!online} />}
      </Sheet>
      <Sheet open={Boolean(sheet && 'withdraw' in Object(sheet))} title="Registrar mi retiro" onClose={() => setSheet(null)}>
        {sheet && typeof sheet === 'object' && 'withdraw' in sheet && (
          <WithdrawalForm
            suggested={sheet.withdraw}
            businessName={businessName}
            today={today}
            disabled={!online}
            onSubmit={handleWithdraw}
          />
        )}
      </Sheet>
      <Sheet open={Boolean(opened)} title={opened ? MOVEMENT_KINDS[opened.kind].label : ''} onClose={() => setSheet(null)}>
        {opened && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Descripción</dt>
                <dd className="break-words text-right font-medium">{opened.description}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Monto</dt>
                <dd className="font-medium tabular-nums">{formatMoney(opened.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Categoría</dt>
                <dd>{BUSINESS_CATEGORIES[opened.category]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Fecha</dt>
                <dd>{formatRelativeDay(opened.date)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Lo registró</dt>
                <dd>
                  {opened.registeredBy
                    ? opened.registeredBy.id === myId
                      ? 'Tú'
                      : opened.registeredBy.name || 'Un socio'
                    : 'Un exsocio'}
                </dd>
              </div>
            </dl>
            {canDelete &&
              (isWithdrawal ? (
                <ConfirmButton
                  label="Deshacer retiro"
                  question="¿Deshacer este retiro? También se quita el ingreso de tus movimientos."
                  confirmLabel="Sí, deshacer"
                  icon={Undo2}
                  disabled={!online}
                  onConfirm={handleDelete}
                />
              ) : (
                <ConfirmButton
                  label="Borrar movimiento"
                  question="¿Borrar este movimiento del negocio? No se puede deshacer."
                  confirmLabel="Sí, borrar"
                  icon={Trash2}
                  disabled={!online}
                  onConfirm={handleDelete}
                />
              ))}
            {isWithdrawal && !isMine && <p className="text-sm text-ink/60">Solo el socio que hizo el retiro puede deshacerlo.</p>}
          </div>
        )}
      </Sheet>
    </section>
  );
}
