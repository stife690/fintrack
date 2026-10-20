/**
 * Encabezado de una sección de la zona privada: título, descripción opcional y acciones a la derecha.
 * @param {{ title: string, description?: React.ReactNode, actions?: React.ReactNode }} props
 */
export default function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
