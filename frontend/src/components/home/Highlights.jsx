import Reveal from '@/components/common/Reveal';

const ITEMS = [
  {
    icon: '/images/icons/wallet.svg',
    tag: 'Presupuestos',
    title: 'Sabe cuánto te queda, siempre',
    description: 'Define límites por categoría, mira cuánto llevas gastado y recibe alertas antes de pasarte.',
  },
  {
    icon: '/images/icons/growth.svg',
    tag: 'Reportes',
    title: 'Entiende a dónde va tu dinero',
    description: 'Dashboard por categoría y periodo, y exportación de tus reportes en PDF o CSV.',
  },
  {
    icon: '/images/icons/star.svg',
    tag: 'Inteligencia artificial',
    title: 'Recomendaciones hechas para ti',
    description: 'La IA categoriza tus gastos automáticamente y analiza tus hábitos para sugerirte dónde ahorrar.',
  },
  {
    icon: '/images/icons/globe.svg',
    tag: 'Sincronización',
    title: 'Tus datos en todos tus dispositivos',
    description: 'Registra sin internet: FinTrack guarda todo localmente y sincroniza cuando vuelves a estar en línea.',
  },
];

/** Tarjetas destacadas con los iconos de la plantilla (sección "Business Account"). */
export default function Highlights() {
  return (
    <section className="pb-12 md:pb-20 xl:pb-32" aria-label="Beneficios">
      <div className="container-page grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {ITEMS.map((item, i) => (
          <Reveal
            key={item.title}
            delay={i * 0.1}
            className="group flex flex-col gap-6 rounded-3xl border border-border p-8 transition-shadow hover:shadow-elevated"
          >
            <img src={item.icon} alt="" aria-hidden="true" width="48" height="48" loading="lazy" className="size-12" />
            <div className="space-y-3">
              <p className="text-sm font-medium text-violet">{item.tag}</p>
              <h3 className="text-2xl font-semibold tracking-tight text-obsidian">{item.title}</h3>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
