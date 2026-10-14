import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentSubscription,
  getReadyRegistration,
  isPushSupported,
  urlBase64ToUint8Array,
} from '@/lib/push';
import { getVapidPublicKey, registerSubscription, removeSubscription } from '@/services/pushService';

/**
 * Estado y acciones de las notificaciones push de este dispositivo (REQ-029).
 * El permiso solo se pide cuando el usuario pulsa «Activar», y su decisión se respeta:
 * si lo niega no se vuelve a insistir.
 *
 * @returns {{
 *   supported: boolean,
 *   permission: NotificationPermission|'unsupported',
 *   subscribed: boolean,
 *   checking: boolean,
 *   busy: boolean,
 *   error: string,
 *   enable: () => Promise<boolean>,
 *   disable: () => Promise<boolean>
 * }}
 */
export default function usePushNotifications() {
  const supported = isPushSupported();
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported) return undefined;
    let cancelled = false;
    getCurrentSubscription()
      .then((subscription) => !cancelled && setSubscribed(Boolean(subscription)))
      .catch(() => {})
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [supported]);

  /** Pide permiso, suscribe este dispositivo y lo registra en el servidor. */
  const enable = useCallback(async () => {
    setError('');
    setBusy(true);
    let subscription = null;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return false;

      const [registration, key] = await Promise.all([getReadyRegistration(), getVapidPublicKey()]);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await registerSubscription(subscription.toJSON());
      setSubscribed(true);
      return true;
    } catch (err) {
      // Si el servidor no la guardó, se deshace la suscripción local para no quedar a medias.
      await subscription?.unsubscribe().catch(() => {});
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Elimina la suscripción de este dispositivo en el servidor y en el navegador. */
  const disable = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const subscription = await getCurrentSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported, permission, subscribed, checking, busy, error, enable, disable };
}
