import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { COLOR_OPTIONS, ICON_OPTIONS, customStyle } from '@/lib/categoryStyles';
import { lockScroll } from '@/lib/scrollLock';
import { cn } from '@/lib/utils';
import { createCategory, deleteCategory, updateCategory } from '@/services/transactionService';

/** Largo máximo del nombre, igual que en la API. */
export const NAME_MAX = 30;

const EASE_DRAWER = [0.32, 0.72, 0, 1];

/**
 * Categoría a la que pasan los movimientos de una propia que se elimina.
 * @param {'gasto'|'ingreso'} type
 */
const fallbackName = (type) => (type === 'ingreso' ? 'Otros ingresos' : 'Otros');

/**
 * Mensaje tras eliminar: cuántos movimientos cambiaron de categoría y a cuál.
 * @param {number} moved
 * @param {'gasto'|'ingreso'} type
 * @returns {string}
 */
export function deletedMessage(moved, type) {
  if (moved === 0) return 'Categoría eliminada.';
  return `Categoría eliminada. ${moved} ${moved === 1 ? 'movimiento pasó' : 'movimientos pasaron'} a ${fallbackName(type)}.`;
}

/**
 * Ventana para crear una categoría propia (hasta 20 por usuario) o editar una: nombre, ícono y
 * color, con una vista previa. Al editar también se puede eliminar, con confirmación.
 * En el celular sube desde abajo; en pantallas anchas va centrada.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {'gasto'|'ingreso'} [props.type] Tipo de la categoría nueva. Sin él, la persona lo elige.
 * @param {import('@/services/transactionService').Category} [props.category] Si llega, se edita esa.
 * @param {() => void} props.onClose
 * @param {(category: import('@/services/transactionService').Category) => void} props.onCreated
 *   Al crear o guardar, con la categoría que devolvió el servidor.
 * @param {(category: import('@/services/transactionService').Category & { type: 'gasto'|'ingreso' }, moved: number) => void} [props.onDeleted]
 *   Al eliminar la categoría que se editaba, con cuántos movimientos pasaron a "Otros".
 */
export default function NewCategoryDialog({ open, type, category, onClose, onCreated, onDeleted }) {
  // Portal al contenedor con `data-theme`: queda encima de todo y conserva el tema.
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <Dialog
            key="categoria"
            type={type}
            category={category}
            onClose={onClose}
            onCreated={onCreated}
            onDeleted={onDeleted}
          />
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.querySelector('[data-theme]') ?? document.body,
  );
}

function Dialog({ type: fixedType, category, onClose, onCreated, onDeleted }) {
  const titleId = useId();
  const nameId = useId();
  const panelRef = useRef(null);
  const nameRef = useRef(null);
  const online = useOnlineStatus();
  // Se guarda al montar, antes de que el efecto mueva el foco al nombre.
  const [opener] = useState(() => document.activeElement);
  const editing = Boolean(category);
  const [type, setType] = useState(category?.type ?? fixedType ?? 'gasto');
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? ICON_OPTIONS[0].key);
  const [color, setColor] = useState(category?.color ?? COLOR_OPTIONS[0].key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mientras está abierta: el foco va al nombre, la página no se desplaza, Escape cierra, Tab no
  // sale de la ventana y al cerrar el foco vuelve al botón que la abrió. El foco se pone aquí y no
  // con el atributo autofocus: en desarrollo React (StrictMode) repite el efecto, y su limpieza,
  // que devuelve el foco al botón, se lo quitaba al campo.
  useEffect(() => {
    nameRef.current?.focus();
    const unlockScroll = lockScroll();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [
        ...panelRef.current.querySelectorAll(
          'input:not([type="radio"]), input[type="radio"]:checked, button:not([disabled])',
        ),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unlockScroll();
      window.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [opener]);

  const submit = async (event) => {
    event.preventDefault();
    // En React el envío sube por el árbol de componentes aunque la ventana esté en un portal:
    // sin esto también "enviaría" el formulario de movimiento o de presupuesto que la abrió.
    event.stopPropagation();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      setError('Escribe un nombre para la categoría.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = editing
        ? await updateCategory(category.key, { name: clean, icon, color })
        : await createCategory({ name: clean, type, icon, color });
      onCreated(saved);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      const { moved } = await deleteCategory(category.key);
      onDeleted?.({ ...category, type }, moved);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const { icon: PreviewIcon, className: previewTone } = customStyle({ icon, color });
  const typeLabel = type === 'gasto' ? 'gasto' : 'ingreso';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
        transition={{ duration: 0.32, ease: EASE_DRAWER }}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-canvas px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-ink shadow-2xl ring-1 ring-ink/10 md:rounded-3xl md:px-6 md:pb-6 md:pt-6"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20 md:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-violet"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <h2 id={titleId} className="pr-10 text-lg font-semibold tracking-tight">
          {editing ? 'Editar categoría' : `Nueva categoría de ${typeLabel}`}
        </h2>

        {!editing && !fixedType && (
          <div role="radiogroup" aria-label="Tipo" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
            {[
              ['gasto', 'Gasto'],
              ['ingreso', 'Ingreso'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                onClick={() => setType(value)}
                className={cn(
                  'rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                  type === value ? 'bg-surface text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-ink/10 px-4 py-3">
          <span aria-hidden="true" className={cn('grid size-11 shrink-0 place-items-center rounded-xl', previewTone)}>
            <PreviewIcon className="size-5" />
          </span>
          <p className="min-w-0 truncate font-medium">{name.trim() || 'Tu categoría'}</p>
        </div>

        <label htmlFor={nameId} className="mt-5 block text-sm font-medium text-ink/80">
          Nombre
        </label>
        <input
          ref={nameRef}
          id={nameId}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError('');
          }}
          maxLength={NAME_MAX}
          autoComplete="off"
          placeholder={type === 'gasto' ? 'Mascotas, Gimnasio, Universidad…' : 'Ventas, Arriendo recibido…'}
          aria-invalid={Boolean(error) || undefined}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink/40 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink/80">Ícono</legend>
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
            {ICON_OPTIONS.map(({ key, icon: Icon, label }) => (
              <label
                key={key}
                title={label}
                className={cn(
                  'grid h-11 cursor-pointer place-items-center rounded-xl border transition-colors',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
                  icon === key
                    ? 'border-brand bg-brand-soft/60 text-brand ring-1 ring-brand'
                    : 'border-ink/10 text-ink/70 hover:border-ink/25 hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="icon"
                  value={key}
                  checked={icon === key}
                  onChange={() => setIcon(key)}
                  aria-label={label}
                  className="sr-only"
                />
                <Icon className="size-5" aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-ink/80">Color</legend>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {COLOR_OPTIONS.map(({ key, label, swatch }) => (
              <label
                key={key}
                title={label}
                className={cn(
                  'grid size-9 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-canvas transition-shadow',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-violet',
                  color === key ? 'ring-2 ring-ink/70' : 'ring-0',
                )}
              >
                <input
                  type="radio"
                  name="color"
                  value={key}
                  checked={color === key}
                  onChange={() => setColor(key)}
                  aria-label={label}
                  className="sr-only"
                />
                <span aria-hidden="true" className={cn('size-7 rounded-full', swatch)} />
              </label>
            ))}
          </div>
        </fieldset>

        {(error || !online) && (
          <p role="alert" className="mt-4 text-sm text-negative">
            {error || `Necesitas internet para ${editing ? 'cambiar' : 'crear'} una categoría.`}
          </p>
        )}

        {confirmingDelete ? (
          <div role="group" aria-label="Confirmar eliminación" className="mt-6 rounded-2xl bg-negative/10 p-4">
            <p className="text-sm font-medium">¿Eliminar “{category.name}”?</p>
            <p className="mt-1 text-sm text-ink/70">
              Sus movimientos pasarán a {fallbackName(type)} y sus presupuestos se borrarán.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* Aparece al pulsar "Eliminar categoría", que desaparece: el foco pasa aquí. */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={saving}
                autoFocus
              >
                No
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={remove}
                disabled={saving || !online}
                className="border-negative/40 text-negative hover:bg-negative/10"
              >
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                Sí, eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !online}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        )}
        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setConfirmingDelete(true);
            }}
            className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-negative transition-colors hover:bg-negative/10 focus-visible:outline-2 focus-visible:outline-violet"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Eliminar categoría
          </button>
        )}
        {!editing && <p className="mt-3 text-center text-xs text-ink/55">Puedes tener hasta 20 categorías propias.</p>}
      </motion.form>
    </div>
  );
}
