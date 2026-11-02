import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Botón con confirmación en línea (sin diálogos del navegador).
 * @param {{ label: string, question: string, confirmLabel: string, icon: import('lucide-react').LucideIcon, disabled?: boolean, onConfirm: () => Promise<void> }} props
 */
export default function ConfirmButton({ label, question, confirmLabel, icon: Icon, disabled, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!confirming) {
    return (
      <Button variant="ghost" className="justify-start text-negative" disabled={disabled} onClick={() => setConfirming(true)}>
        <Icon aria-hidden="true" /> {label}
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl bg-negative/5 p-3">
      <p className="text-sm">{question}</p>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onConfirm();
            } catch (err) {
              setError(err.message);
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
