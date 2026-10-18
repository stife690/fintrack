import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthContext';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { MAX_NAME_LENGTH, updateProfile } from '@/services/userService';

/**
 * Perfil en Cuenta: avatar, nombre y correo. El nombre se edita en el mismo lugar
 * (PATCH /users/me) y se refleja al instante en el saludo y el menú.
 */
export default function ProfileCard() {
  const { user, updateUser } = useAuth();
  const online = useOnlineStatus();
  const inputId = useId();
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    setDraft(user.name ?? '');
    setError('');
    setNotice('');
    setEditing(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const clean = draft.trim().replace(/\s+/g, ' ');
    if (clean.length > MAX_NAME_LENGTH) {
      setError(`Máximo ${MAX_NAME_LENGTH} caracteres.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const profile = await updateProfile(clean || null);
      updateUser({ name: profile.name });
      setNotice(profile.name ? 'Nombre guardado.' : 'Nombre borrado.');
      setEditing(false);
    } catch (err) {
      setError(err.fields?.name ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel aria-labelledby="perfil">
      <h2 id="perfil" className="sr-only">
        Perfil
      </h2>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-xl font-semibold text-brand"
        >
          {getInitial(user)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{getDisplayName(user) || 'Tu cuenta'}</p>
          <p className="truncate text-ink/60">{user.email}</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing} disabled={!online}>
            <Pencil aria-hidden="true" />
            {user.name ? 'Editar nombre' : 'Agregar nombre'}
          </Button>
        )}
      </div>

      {!editing && !user.name && (
        <p className="mt-4 text-sm text-ink/60">
          Agrega tu nombre para que te saludemos por él. Por ahora usamos el de tu correo.
        </p>
      )}

      {editing && (
        <form onSubmit={save} noValidate className="mt-5 space-y-3">
          <Label htmlFor={inputId}>Tu nombre</Label>
          <Input
            ref={inputRef}
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="given-name"
            placeholder="Felipe"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            disabled={saving}
          />
          {error && (
            <p id={`${inputId}-error`} role="alert" className="text-sm text-negative">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving || !online}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {saving ? 'Guardando…' : 'Guardar nombre'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <p role="status" className="text-sm text-positive [&:not(:empty)]:mt-3">
        {notice}
      </p>
    </Panel>
  );
}
