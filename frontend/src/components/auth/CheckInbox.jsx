import { useEffect, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';

/** Segundos de espera antes de poder reenviar el enlace. */
const RESEND_SECONDS = 60;

/**
 * Estado "Revisa tu correo" de los enlaces de la cuenta (recuperar la contraseña y confirmar el
 * correo): a dónde se envió, consejos, reenvío con cuenta regresiva y la opción de corregir el correo.
 * @param {{
 *   title?: string,
 *   subtitle: import('react').ReactNode,
 *   tips: string[],
 *   onResend: () => Promise<unknown>,
 *   onChangeEmail: () => void,
 *   footer?: import('react').ReactNode,
 * }} props
 */
export default function CheckInbox({ title = 'Revisa tu correo', subtitle, tips, onResend, onChangeEmail, footer }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState('');

  // Un solo intervalo mientras quede tiempo; se limpia al llegar a 0 o al salir de la pantalla.
  const counting = secondsLeft > 0;
  useEffect(() => {
    if (!counting) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const resend = async () => {
    setResending(true);
    setNotice('');
    try {
      await onResend();
      setNotice('Te enviamos un enlace nuevo. El anterior ya no sirve.');
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout icon={MailCheck} title={title} subtitle={subtitle} footer={footer}>
      <ul className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full border-white/15 text-white hover:bg-white/5"
          disabled={counting || resending}
          onClick={resend}
        >
          {resending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {counting ? (
            <>
              Reenviar enlace en{' '}
              <span className="tabular-nums">
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </>
          ) : (
            'Reenviar enlace'
          )}
        </Button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="w-full rounded-xl py-2 text-sm text-white/55 transition-colors hover:text-white"
        >
          Usar otro correo
        </button>
        {notice && (
          <p className="text-center text-sm text-white/65" role="status">
            {notice}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
