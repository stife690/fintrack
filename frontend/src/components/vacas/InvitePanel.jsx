import { useState } from 'react';
import { Check, Copy, Loader2, Mail, RefreshCw, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeDay } from '@/components/transactions/format';
import { inviteLink } from './vacaFormat';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invitar a la vaca (FT-0014): enlace y código para compartir (WhatsApp, etc.) o invitación
 * por correo. Los administradores ven las invitaciones pendientes y pueden cambiar el código.
 *
 * @param {object} props
 * @param {import('@/services/vacaService').Vaca} props.vaca
 * @param {boolean} props.online
 * @param {(email: string) => Promise<{ sent: boolean }>} props.onInvite
 * @param {(email: string) => Promise<void>} props.onCancelInvitation
 * @param {() => Promise<void>} props.onRegenerate
 */
export default function InvitePanel({ vaca, online, onInvite, onCancelInvitation, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const link = inviteLink(vaca.code);
  const isAdmin = vaca.role === 'admin';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: `Vaca "${vaca.name}"`,
        text: `Únete a la vaca "${vaca.name}" en FinTrack (código ${vaca.code}):`,
        url: link,
      });
    } catch {
      // El usuario cerró el menú de compartir: no es un error.
    }
  };

  const run = async (action) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const invite = (event) => {
    event.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError('Escribe un correo válido.');
      return;
    }
    run(async () => {
      const result = await onInvite(clean);
      setEmail('');
      setMessage(result.sent ? `Invitación enviada a ${clean}.` : `Ya le enviamos la invitación a ${clean} hace un momento.`);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-ink/80">Enlace para unirse</p>
        <div className="mt-2 flex gap-2">
          <Input readOnly value={link} aria-label="Enlace de invitación" className="min-w-0 text-sm" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="icon" className="size-12 shrink-0" onClick={copy} aria-label="Copiar enlace">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
        <p className="mt-2 text-sm text-ink/60">
          O comparte el código <span className="font-mono text-base font-semibold tracking-widest text-ink">{vaca.code}</span>{' '}
          (en Vacas → Tengo un código).
        </p>
        {canShare && (
          <Button type="button" variant="outline" className="mt-3" onClick={share}>
            <Share2 aria-hidden="true" /> Compartir
          </Button>
        )}
      </div>

      <form onSubmit={invite} noValidate className="space-y-2">
        <label htmlFor="invite-email" className="text-sm font-medium text-ink/80">
          Invitar por correo
        </label>
        <Input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!online}
        />
        <Button type="submit" size="lg" variant="outline" className="w-full" disabled={!online || busy || !email}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
          Enviar invitación
        </Button>
      </form>

      <p role="status" className="min-h-5 text-sm text-positive">
        {message}
      </p>
      {error && (
        <p role="alert" className="-mt-4 text-sm text-negative">
          {error}
        </p>
      )}

      {isAdmin && vaca.invitations?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink/80">Invitaciones pendientes</p>
          <ul className="mt-2 divide-y divide-ink/10">
            {vaca.invitations.map((inv) => (
              <li key={inv.email} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{inv.email}</span>
                  <span className="text-xs text-ink/60">Enviada: {formatRelativeDay(inv.sentAt.slice(0, 10))}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!online || busy}
                  onClick={() => run(() => onCancelInvitation(inv.email))}
                  aria-label={`Cancelar invitación a ${inv.email}`}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin &&
        (confirmingCode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink/60">El enlace actual dejará de servir. ¿Cambiar el código?</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(async () => (await onRegenerate(), setConfirmingCode(false)))}
            >
              Sí, cambiar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingCode(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" disabled={!online} onClick={() => setConfirmingCode(true)}>
            <RefreshCw aria-hidden="true" /> Cambiar código
          </Button>
        ))}
    </div>
  );
}
