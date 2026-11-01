/**
 * Encabezado de una sección de la zona privada: título, descripción opcional y acciones a la derecha.
 * Los títulos largos parten la línea y las acciones bajan a otra fila si no caben (celular).
 * @param {{ title: string, description?: React.ReactNode, actions?: React.ReactNode }} props
 */
export default function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0 max-w-full">
        <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 break-words text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
