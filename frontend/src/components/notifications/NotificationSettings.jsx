import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePushNotifications from '@/hooks/usePushNotifications';
import { getDeviceTimezone } from '@/lib/push';
import { getReminderSettings, saveReminderSettings } from '@/services/pushService';

/** Hora que se propone la primera vez que el usuario programa el recordatorio. */
const SUGGESTED_TIME = '20:00';

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
  const [time, setTime] = useState('');
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
        setTime(settings.time ?? '');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Guarda la hora del recordatorio; `null` lo desactiva. */
  const saveReminder = async (nextTime) => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const settings = await saveReminderSettings({ time: nextTime, timezone });
      setSaved(settings);
      setTime(settings.time ?? '');
      setNotice(
        settings.time ? `Listo: te recordaremos todos los días a las ${settings.time}.` : 'Recordatorio desactivado.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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

  const reminderOn = Boolean(saved?.time);
  const unchanged = saved?.time === time && saved?.timezone === timezone;

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

      <Card title="Recordatorio diario">
        <p className="text-ink/60">Un aviso cada día para que registres tus gastos.</p>
        {loading ? (
          <p className="text-ink/60">Cargando…</p>
        ) : (
          <>
            <div className="flex max-w-xs flex-col gap-2">
              <Label htmlFor="reminder-time">Hora del recordatorio</Label>
              <Input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={saving}
              />
              <p className="text-sm text-ink/50">Zona horaria: {timezone}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => saveReminder(time || SUGGESTED_TIME)} disabled={saving || (unchanged && reminderOn)}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {reminderOn ? 'Guardar cambios' : 'Activar recordatorio'}
              </Button>
              {reminderOn && (
                <Button variant="outline" onClick={() => saveReminder(null)} disabled={saving}>
                  Desactivar recordatorio
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
