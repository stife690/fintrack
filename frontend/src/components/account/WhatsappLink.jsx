import { useState } from 'react';
import { CircleCheck, Loader2, MessageCircle, RefreshCw, Unlink } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { createWhatsappCode, deleteWhatsappLink, getWhatsappLink } from '@/services/whatsappService';

/**
 * Enlace que abre el chat del bot con el código ya escrito.
 * @param {string} botNumber Con indicativo, solo dígitos.
 * @param {string} code
 * @returns {string}
 */
export function chatUrl(botNumber, code) {
  return `https://wa.me/${botNumber}?text=${encodeURIComponent(code)}`;
}

/** Paso con el código: el usuario se lo envía al bot y luego revisa la conexión. */
function CodeStep({ pending, checking, onCheck }) {
  return (
    <div className="space-y-3 rounded-xl bg-brand-soft p-4">
      <p className="text-sm text-ink/60">Envíale este código al bot. Vence en 10 minutos y sirve una sola vez.</p>
      <p className="select-all text-xl font-semibold tabular-nums tracking-wider text-brand">{pending.code}</p>
      <div className="flex flex-wrap gap-2">
        {pending.botNumber && (
          <Button asChild>
            <a href={chatUrl(pending.botNumber, pending.code)} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              Abrir WhatsApp
            </a>
          </Button>
        )}
        <Button variant="soft" onClick={onCheck} disabled={checking}>
          {checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          Ya lo envié
        </Button>
      </div>
    </div>
  );
}

/**
 * Conexión con el bot en Cuenta (FT-0029). Si el bot no está configurado no se muestra.
 */
export default function WhatsappLink() {
  const online = useOnlineStatus();
  const { data, error, loading, reload } = useAsync(getWhatsappLink, []);
  const [pending, setPending] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  if (!data?.available) {
    if (!error) return null;
    return (
      <Panel>
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      </Panel>
    );
  }

  const createCode = async () => {
    setCreating(true);
    setCreateError('');
    try {
      setPending(await createWhatsappCode());
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const unlink = async () => {
    await deleteWhatsappLink();
    setPending(null);
    reload();
  };

  return (
    <Panel aria-labelledby="whatsapp-title">
      <h2 id="whatsapp-title" className="text-lg font-semibold tracking-tight">
        WhatsApp
      </h2>
      <p className="mt-1 text-sm text-ink/60">Registra movimientos desde el chat, como "almuerzo 15 mil".</p>

      <div className="mt-5 space-y-3">
        {data.linked ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-5 shrink-0 text-positive" aria-hidden="true" />
              Conectado con {data.phone}
            </p>
            <ConfirmButton
              label="Desconectar"
              question="¿Desconectar este número? Tus movimientos no se borran."
              confirmLabel="Sí, desconectar"
              icon={Unlink}
              disabled={!online}
              onConfirm={unlink}
            />
          </>
        ) : pending ? (
          <CodeStep pending={pending} checking={loading} onCheck={reload} />
        ) : (
          <Button onClick={createCode} disabled={creating || !online}>
            {creating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
            Conectar WhatsApp
          </Button>
        )}
        {createError && (
          <p role="alert" className="text-sm text-negative">
            {createError}
          </p>
        )}
      </div>
    </Panel>
  );
}
