import { useState } from 'react';
import { Check, Copy, Loader2, Mail, RefreshCw, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatRelativeDay } from '@/components/transactions/format';
import { ROLES, ROLE_OPTIONS, inviteLink } from './negocioFormat';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invitar socios al negocio (FT-0016), solo para dueños: enlace y código para compartir (entran
 * como editores) o invitación por correo con el rol elegido. Muestra las invitaciones pendientes
 * y permite cambiar el código.
 *
 * @param {object} props
 * @param {import('@/services/negocioService').Business} props.business
 * @param {boolean} props.online
 * @param {(email: string, role: string) => Promise<{ sent: boolean }>} props.onInvite
 * @param {(email: string) => Promise<void>} props.onCancelInvitation
 * @param {() => Promise<void>} props.onRegenerate
 */
export default function NegocioInvitePanel({ business, online, onInvite, onCancelInvitation, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const link = inviteLink(business.code);
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
        title: `Negocio "${business.name}"`,
        text: `Únete al negocio "${business.name}" en FinTrack (código ${business.code}):`,
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
      const result = await onInvite(clean, role);
      setEmail('');
      setMessage(
        result.sent
          ? `Invitación enviada a ${clean} como ${ROLES[role].label.toLowerCase()}.`
          : `Ya le enviamos la invitación a ${clean} hace un momento (quedó como ${ROLES[role].label.toLowerCase()}).`,
      );
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-ink/80">Enlace para unirse</p>
        <div className="mt-2 flex gap-2">
          <Input readOnly value={link} aria-label="Enlace de invitación" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="icon" className="size-12 shrink-0" onClick={copy} aria-label="Copiar enlace">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
        <p className="mt-2 text-sm text-ink/60">
          O comparte el código{' '}
          <span className="font-mono text-base font-semibold tracking-widest text-ink">{business.code}</span>. Con el
          enlace o el código entran como editores; para otro rol, invita por correo.
        </p>
        {canShare && (
          <Button type="button" variant="outline" className="mt-3" onClick={share}>
            <Share2 aria-hidden="true" /> Compartir
          </Button>
        )}
      </div>

      <form onSubmit={invite} noValidate className="space-y-2">
        <label htmlFor="negocio-invite-email" className="text-sm font-medium text-ink/80">
          Invitar por correo
        </label>
        <Input
          id="negocio-invite-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!online}
        />
        <div className="flex gap-2">
          <Select aria-label="Rol de la persona invitada" value={role} onChange={(e) => setRole(e.target.value)} disabled={!online}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button type="submit" className="h-12 shrink-0" disabled={!online || busy || !email}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
            Invitar
          </Button>
        </div>
        <p className="text-sm text-ink/60">{ROLES[role].hint}.</p>
      </form>

      <p role="status" className="min-h-5 text-sm text-positive">
        {message}
      </p>
      {error && (
        <p role="alert" className="-mt-4 text-sm text-negative">
          {error}
        </p>
      )}

      {business.invitations?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink/80">Invitaciones pendientes</p>
          <ul className="mt-2 divide-y divide-ink/10">
            {business.invitations.map((inv) => (
              <li key={inv.email} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{inv.email}</span>
                  <span className="text-xs text-ink/60">
                    {ROLES[inv.role].label} · enviada: {formatRelativeDay(inv.sentAt.slice(0, 10))}
                  </span>
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

      {confirmingCode ? (
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
      )}
    </div>
  );
}
