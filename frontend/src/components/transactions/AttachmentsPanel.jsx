import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { prepareUpload } from '@/lib/compressImage';
import {
  deleteAttachment,
  fetchAttachment,
  listAttachments,
  uploadAttachment,
} from '@/services/attachmentService';

/**
 * Tamaño legible: `320 KB`, `1,2 MB`.
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Soportes de pago de un movimiento (FT-0044): tomar una foto o subir un PDF, verlo y borrarlo.
 * Si el usuario aún no tiene los soportes activos (la API responde `FEATURE_DISABLED`), no se
 * muestra nada. Diseño básico; Nicolás lo pule en FT-0052.
 * @param {{ transactionId: string }} props
 */
export default function AttachmentsPanel({ transactionId }) {
  const online = useOnlineStatus();
  const [state, setState] = useState({ status: 'loading' }); // loading | hidden | ready | error
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const cameraInput = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setMessage('');
    listAttachments(transactionId)
      .then((data) => !cancelled && setState({ status: 'ready', ...data }))
      .catch((err) => {
        if (cancelled) return;
        setState(err.code === 'FEATURE_DISABLED' ? { status: 'hidden' } : { status: 'error', error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  if (state.status === 'hidden') return null;

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite elegir el mismo archivo otra vez
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const { blob, name } = await prepareUpload(file);
      if (blob.size > state.maxBytes) throw new Error('El archivo pesa más de 5 MB.');
      const created = await uploadAttachment(transactionId, blob, name);
      setState((s) => ({ ...s, items: [...s.items, created] }));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (attachment) => {
    setMessage('');
    // La pestaña se abre antes de esperar la descarga: si no, el navegador la bloquea.
    const tab = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await fetchAttachment(transactionId, attachment.id));
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setMessage(err.message);
    }
  };

  const remove = async (attachment) => {
    if (!window.confirm(`¿Borrar "${attachment.name}"?`)) return;
    setMessage('');
    try {
      await deleteAttachment(transactionId, attachment.id);
      setState((s) => ({ ...s, items: s.items.filter((a) => a.id !== attachment.id) }));
    } catch (err) {
      setMessage(err.message);
    }
  };

  const full = state.status === 'ready' && state.items.length >= state.max;

  return (
    <section aria-labelledby="soportes-title" className="mt-5 border-t border-ink/10 pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="soportes-title" className="flex items-center gap-2 font-semibold">
          <Paperclip className="size-4" aria-hidden="true" /> Soportes
        </h3>
        {state.status === 'ready' && (
          <span className="text-sm text-ink/60">
            {state.items.length} de {state.max}
          </span>
        )}
      </div>

      {state.status === 'loading' && <Loader2 className="mx-auto animate-spin text-ink/40" aria-label="Cargando soportes" />}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-negative">
          {state.error}
        </p>
      )}

      {state.status === 'ready' && (
        <>
          {state.items.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {state.items.map((a) => {
                const Icon = a.type === 'application/pdf' ? FileText : ImageIcon;
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl bg-ink/5 p-2">
                    <Icon className="size-5 flex-none text-violet-light" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => open(a)}
                      className="min-w-0 flex-1 text-left text-sm underline-offset-4 hover:underline"
                    >
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="text-xs text-ink/60">{formatSize(a.size)} · Toca para verlo</span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Borrar ${a.name}`} onClick={() => remove(a)}>
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {!online ? (
            <p className="text-sm text-ink/60">Necesitas conexión para adjuntar soportes.</p>
          ) : (
            !full && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => cameraInput.current?.click()}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
                  Tomar foto
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
                  <FileText aria-hidden="true" /> Subir archivo
                </Button>
              </div>
            )
          )}
          {/* `capture`: en el celular abre la cámara directo. */}
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={upload} />
          <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={upload} />

          {message && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {message}
            </p>
          )}
          <p className="mt-3 text-xs text-ink/50">
            Solo tú puedes ver tus soportes. Se borran si eliminas el movimiento.
          </p>
        </>
      )}
    </section>
  );
}
