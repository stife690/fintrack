import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Plus, X } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePushNotifications from '@/hooks/usePushNotifications';
import { getDeviceTimezone } from '@/lib/push';
import { getReminderSettings, saveReminderSettings } from '@/services/pushService';

/** Máximo de recordatorios al día (lo mismo que valida la API). */
const MAX_REMINDERS = 5;

/** Hora que se propone la primera vez; al agregar más se usa la primera de estas que no esté en uso. */
const SUGGESTED_TIMES = ['20:00', '08:00', '13:00', '18:00', '22:00'];

/** Primera hora sugerida que todavía no está en la lista (o la última sugerida si todas están). */
const nextSuggestion = (times) => SUGGESTED_TIMES.find((t) => !times.includes(t)) ?? SUGGESTED_TIMES[0];

/** Horas únicas, ordenadas y sin vacíos: lo que se envía a la API. */
const normalize = (times) => [...new Set(times.filter(Boolean))].sort();

/** `20:00` → `8:00 p. m.` (formato es-CO). */
function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** Tarjeta de ajustes de la zona privada. */
function Card({ title, children }) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </Panel>
  );
}

/**
 * Permiso de notificaciones de este dispositivo (REQ-029) y recordatorio diario (REQ-030).
 * La hora se guarda con la zona horaria del dispositivo para que el aviso llegue a la hora local.
 */
export default function NotificationSettings() {
  const push = usePushNotifications();
  const timezone = getDeviceTimezone();

  const [saved, setSaved] = useState(null);
  const [times, setTimes] = useState([SUGGESTED_TIMES[0]]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getReminderSettings()
      .then((settings) => {
        if (cancelled) return;
        setSaved(settings);
        setTimes(settings.times.length > 0 ? settings.times : [SUGGESTED_TIMES[0]]);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Guarda las horas del recordatorio; una lista vacía lo desactiva. */
  const saveReminder = async (nextTimes) => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const settings = await saveReminderSettings({ times: nextTimes, timezone });
      setSaved(settings);
      setTimes(settings.times.length > 0 ? settings.times : [SUGGESTED_TIMES[0]]);
      // `formatTime` ya termina en punto ("p. m."), así que el mensaje no agrega otro.
      const list = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(
        settings.times.map(formatTime),
      );
      setNotice(
        settings.times.length === 0
          ? 'Recordatorio desactivado.'
          : `Listo: te recordaremos todos los días a las ${list}${list.endsWith('.') ? '' : '.'}`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateTime = (index, value) => setTimes((current) => current.map((t, i) => (i === index ? value : t)));
  const removeTime = (index) => setTimes((current) => current.filter((_, i) => i !== index));
  const addTime = () => setTimes((current) => [...current, nextSuggestion(current)]);

  const handleEnable = async () => {
    setNotice('');
    const ok = await push.enable();
    if (ok) setNotice('Notificaciones activadas en este dispositivo.');
  };

  const handleDisable = async () => {
    setNotice('');
    const ok = await push.disable();
    if (ok) setNotice('Notificaciones desactivadas en este dispositivo.');
  };

  const reminderOn = (saved?.times.length ?? 0) > 0;
  const cleaned = normalize(times);
  const hasEmpty = times.some((t) => !t);
  const hasDuplicates = cleaned.length < times.filter(Boolean).length;
  const unchanged = JSON.stringify(saved?.times) === JSON.stringify(cleaned) && saved?.timezone === timezone;

  return (
    <div className="flex flex-col gap-5">
      <Card title="Notificaciones en este dispositivo">
        {!push.supported ? (
          <p className="text-ink/60">
            Este navegador no permite notificaciones. En iPhone, instala FinTrack en la pantalla de inicio y ábrela
            desde allí.
          </p>
        ) : push.permission === 'denied' ? (
          <p className="text-ink/60">
            Bloqueaste las notificaciones de FinTrack. Para activarlas, permítelas en los ajustes del sitio de tu
            navegador (el candado junto a la dirección) y recarga la página.
          </p>
        ) : push.checking ? (
          <p className="text-ink/60">Comprobando…</p>
        ) : push.subscribed ? (
          <>
            <p className="flex items-center gap-2 text-ink/60">
              <BellRing className="size-4 text-positive" aria-hidden="true" />
              Activadas en este dispositivo.
            </p>
            <Button variant="outline" onClick={handleDisable} disabled={push.busy} className="self-start">
              {push.busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellOff aria-hidden="true" />}
              Desactivar notificaciones
            </Button>
          </>
        ) : (
          <>
            <p className="text-ink/60">
              Activa las notificaciones para recibir el recordatorio diario. El navegador te pedirá permiso.
            </p>
            <Button onClick={handleEnable} disabled={push.busy} className="self-start">
              {push.busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bell aria-hidden="true" />}
              Activar notificaciones
            </Button>
          </>
        )}
        {push.error && (
          <p role="alert" className="text-sm text-negative">
            {push.error}
          </p>
        )}
      </Card>

      <Card title="Recordatorios diarios">
        <p className="text-ink/60">Hasta {MAX_REMINDERS} avisos al día para que registres tus gastos.</p>
        {loading ? (
          <p className="text-ink/60">Cargando…</p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2" aria-label="Horas del recordatorio">
                {times.map((value, index) => (
                  <li key={index} className="flex max-w-xs items-center gap-2">
                    <Label htmlFor={`reminder-time-${index}`} className="sr-only">
                      Hora del recordatorio {index + 1}
                    </Label>
                    <Input
                      id={`reminder-time-${index}`}
                      type="time"
                      value={value}
                      onChange={(event) => updateTime(index, event.target.value)}
                      disabled={saving}
                    />
                    {times.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar el recordatorio ${index + 1}`}
                        onClick={() => removeTime(index)}
                        disabled={saving}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {times.length < MAX_REMINDERS && (
                <Button type="button" variant="outline" onClick={addTime} disabled={saving} className="self-start">
                  <Plus aria-hidden="true" />
                  Agregar otro recordatorio
                </Button>
              )}
              {hasDuplicates && (
                <p className="text-sm text-ink/60">Hay horas repetidas; se guardará una sola vez.</p>
              )}
              <p className="text-sm text-ink/50">Zona horaria: {timezone}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => saveReminder(cleaned)}
                disabled={saving || hasEmpty || (unchanged && reminderOn)}
              >
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {reminderOn ? 'Guardar cambios' : 'Activar recordatorios'}
              </Button>
              {reminderOn && (
                <Button variant="outline" onClick={() => saveReminder([])} disabled={saving}>
                  Desactivar recordatorios
                </Button>
              )}
            </div>
            {reminderOn && push.supported && !push.checking && !push.subscribed && (
              <p className="text-sm text-ink/60">
                Tienes un recordatorio programado, pero este dispositivo no tiene las notificaciones activadas, así
                que no te llegará.
              </p>
            )}
          </>
        )}
        {error && !push.error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
      </Card>

      {notice && (
        <p role="status" className="text-sm text-positive">
          {notice}
        </p>
      )}
    </div>
  );
}
