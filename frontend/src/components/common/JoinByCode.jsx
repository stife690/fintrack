import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Unirse con un código que alguien compartió: lleva a la vista previa de la invitación
 * (`<basePath>/unirse/<CODIGO>`). Lo usan las vacas y los negocios.
 * @param {{ basePath: string, disabled?: boolean }} props
 */
export default function JoinByCode({ basePath, disabled = false }) {
  const navigate = useNavigate();
  const id = useId();
  const [code, setCode] = useState('');
  const clean = code.trim().toUpperCase();
  const valid = /^[A-Z0-9]{4,8}$/.test(clean);

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) navigate(`${basePath}/unirse/${clean}`);
      }}
    >
      <label htmlFor={id} className="text-sm font-medium text-ink/80">
        Código de invitación
      </label>
      <Input
        id={id}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Ej. K7M2QX"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={8}
        className="font-mono uppercase tracking-widest"
        disabled={disabled}
      />
      <Button type="submit" size="lg" className="w-full" disabled={disabled || !valid}>
        Ver la invitación
      </Button>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión para unirte.</p>}
    </form>
  );
}
