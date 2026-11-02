import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { lockScroll } from '@/lib/scrollLock';

const EASE_DRAWER = [0.32, 0.72, 0, 1];

/** Al soltar la ventana se cierra si bajó esto (px) o iba así de rápido (px/s). */
const CLOSE_OFFSET = 100;
const CLOSE_VELOCITY = 500;

/**
 * Ventana que sube desde abajo en el celular y aparece centrada desde tablet. La usan las vacas y
 * los negocios para aportar, invitar, editar y las opciones, así la página muestra solo lo
 * importante. Mismo estilo y comportamiento que la ventana de categorías.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {string} [props.description] Una línea bajo el título.
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 */
export default function Sheet({ open, title, description, onClose, children }) {
  // Portal al contenedor con `data-theme`: queda encima de todo y conserva el tema.
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <Panel key="sheet" title={title} description={description} onClose={onClose}>
            {children}
          </Panel>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.querySelector('[data-theme]') ?? document.body,
  );
}

/**
 * @param {{ title: string, description?: string, onClose: () => void, children: React.ReactNode }} props
 */
function Panel({ title, description, onClose, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const dragControls = useDragControls();
  // Se guarda al montar, antes de mover el foco dentro de la ventana.
  const [opener] = useState(() => document.activeElement);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mientras está abierta: el foco entra a la ventana, la página no se desplaza, Escape cierra,
  // Tab no sale de la ventana y al cerrar el foco vuelve al botón que la abrió.
  useEffect(() => {
    const focusable = () => [
      ...panelRef.current.querySelectorAll(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea, button:not([disabled]), a[href]',
      ),
    ];
    // El primer campo editable del contenido (no la X de cerrar ni un enlace de solo lectura).
    (focusable().find((el) => !el.dataset.sheetClose && !el.readOnly && el.tagName !== 'BUTTON') ?? panelRef.current).focus();
    const unlockScroll = lockScroll();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
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
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // Se arrastra solo desde la rayita: así el contenido sigue desplazándose con el dedo.
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.8 }}
        onDragEnd={(_event, { offset, velocity }) => {
          if (offset.y > CLOSE_OFFSET || velocity.y > CLOSE_VELOCITY) onClose();
        }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
        transition={{ duration: 0.32, ease: EASE_DRAWER }}
        className="relative max-h-[92dvh] w-full min-w-0 max-w-md overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl bg-canvas px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-ink shadow-2xl ring-1 ring-ink/10 focus:outline-none md:rounded-3xl md:px-6 md:pb-6 md:pt-6"
      >
        <div
          aria-hidden="true"
          onPointerDown={(event) => dragControls.start(event)}
          className="-mx-5 -mt-3 mb-2 cursor-grab touch-none py-4 md:hidden"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          data-sheet-close="true"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-violet"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <h2 id={titleId} className="break-words pr-10 text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-1 break-words pr-6 text-sm text-ink/60">{description}</p>}
        <div className="mt-5">{children}</div>
      </motion.div>
    </div>
  );
}
