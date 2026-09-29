import SectionHeading from '@/components/common/SectionHeading';
import Reveal from '@/components/common/Reveal';

const ITEMS = [
  {
    icon: '/images/icons/shield.svg',
    title: 'Sesiones seguras',
    description: 'Tu contraseña se guarda cifrada, cada sesión usa tokens con expiración y solo tú puedes ver tus movimientos.',
  },
  {
    icon: '/images/icons/check.svg',
    title: 'IA sin tus datos personales',
    description:
      'La IA solo recibe la descripción de un gasto o totales agregados por categoría: nunca tu correo, tu identidad ni tus transacciones completas.',
  },
  {
    icon: '/images/icons/timeline.svg',
    title: 'Sincronización confiable',
    description: 'Lo que registras sin conexión se guarda en tu dispositivo y se sincroniza solo al recuperar la conexión.',
  },
];

/** Sección "Security & Compliance" adaptada a FinTrack. */
export default function Security() {
  return (
    <section id="seguridad" className="scroll-mt-20 py-12 md:py-20 xl:py-32">
      <div className="container-page">
        <SectionHeading
          eyebrow="Seguridad"
          title="Seguridad y privacidad desde el diseño."
          description="Manejar dinero exige confianza. Por eso FinTrack protege tu información en cada paso."
        />

        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.1} className="rounded-3xl bg-card p-8">
              <img src={item.icon} alt="" aria-hidden="true" width="48" height="48" loading="lazy" className="size-12" />
              <h3 className="mt-8 text-xl font-semibold tracking-tight text-obsidian">{item.title}</h3>
              <p className="mt-3 text-muted-foreground">{item.description}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mx-auto mt-10 max-w-3xl rounded-full bg-pink px-6 py-4 text-center text-obsidian">
          ⚡️ La forma más simple de registrar gastos, cumplir presupuestos y entender tus finanzas.
        </Reveal>
      </div>
    </section>
  );
}
