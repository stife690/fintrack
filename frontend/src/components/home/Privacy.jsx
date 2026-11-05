import { EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import Reveal from '@/components/common/Reveal';

const ITEMS = [
  {
    icon: KeyRound,
    title: 'Sesiones seguras',
    description: 'Tu contraseña se guarda cifrada, cada sesión usa tokens con expiración y solo tú puedes ver tus movimientos.',
  },
  {
    icon: EyeOff,
    title: 'IA sin tus datos personales',
    description:
      'Para clasificar o aconsejarte, la IA recibe la descripción de un gasto o totales por categoría, nunca tu correo ni tu identidad. Si dictas por voz, el audio se envía a Groq solo para pasarlo a texto.',
  },
  {
    icon: RefreshCw,
    title: 'Sincronización confiable',
    description: 'Lo que registras sin conexión se guarda en tu dispositivo y se sincroniza solo al recuperar la conexión.',
  },
];

/** Seguridad: campo menta, título a la izquierda y los tres compromisos en lista. */
export default function Privacy() {
  return (
    <section id="seguridad" className="scroll-mt-20 bg-mint py-24 text-obsidian md:py-32">
      <div className="container-page grid gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Seguridad</p>
          <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl">
            Seguridad y privacidad desde el diseño.
          </h2>
          <p className="mt-6 max-w-md text-lg text-obsidian/70 md:text-xl">
            Manejar dinero exige confianza. Por eso FinTrack protege tu información en cada paso.
          </p>
        </div>
        <ul className="divide-y divide-obsidian/10">
          {ITEMS.map(({ icon: Icon, title, description }, i) => (
            <Reveal as="li" key={title} delay={i * 0.08} className="flex gap-5 py-8 first:pt-0 last:pb-0">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-obsidian text-mint">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
                <p className="mt-2 text-lg text-obsidian/70">{description}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
