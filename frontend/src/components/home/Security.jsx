import SectionHeading from '@/components/common/SectionHeading';
import Reveal from '@/components/common/Reveal';
import { ReceiptPaper, ReceiptRow } from './Receipt';

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
      'Para clasificar o aconsejarte, la IA recibe la descripción de un gasto o totales por categoría, nunca tu correo ni tu identidad. Si dictas por voz, el audio se envía a Groq solo para pasarlo a texto.',
  },
  {
    icon: '/images/icons/timeline.svg',
    title: 'Sincronización confiable',
    description: 'Lo que registras sin conexión se guarda en tu dispositivo y se sincroniza solo al recuperar la conexión.',
  },
];

/** Bloque tachado: el dato existe, pero no sale de tu cuenta. */
function Redacted({ children }) {
  return (
    <>
      <span aria-hidden="true" className="select-none rounded-sm bg-obsidian text-obsidian">
        {children}
      </span>
      <span className="sr-only">Dato oculto</span>
    </>
  );
}

/**
 * Tirilla de "lo que ve la IA": la descripción y el monto pasan; tu nombre y tu correo no.
 */
function WhatAiSees() {
  return (
    <div className="mx-auto w-full max-w-[320px] -rotate-2 motion-safe:transition-transform motion-safe:duration-500 hover:rotate-0">
      <ReceiptPaper>
        <p className="text-center text-lg font-bold tracking-tight">LO QUE VE LA IA</p>
        <p className="mb-4 text-center text-xs text-obsidian/60">Al clasificar un gasto</p>
        <ReceiptRow label="Almuerzo" detail="Descripción" value="$18.000" />
        <ReceiptRow label="Nombre" value={<Redacted>Nombre Apellido</Redacted>} />
        <ReceiptRow label="Correo" value={<Redacted>correo@dominio.co</Redacted>} />
        <ReceiptRow strong label="Resultado" value="Alimentación" className="mt-3" />
      </ReceiptPaper>
    </div>
  );
}

/**
 * Seguridad: encabezado y tirilla a la izquierda, los tres compromisos a la derecha.
 */
export default function Security() {
  return (
    <section id="seguridad" className="scroll-mt-20 py-16 md:py-24 xl:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <div className="space-y-12 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="Seguridad"
            title="Seguridad y privacidad desde el diseño."
            description="Manejar dinero exige confianza. Por eso FinTrack protege tu información en cada paso."
          />
          <Reveal delay={0.1} className="rounded-[2rem] bg-pink px-6 py-10">
            <WhatAiSees />
          </Reveal>
        </div>

        <ul className="space-y-4">
          {ITEMS.map((item, i) => (
            <Reveal
              as="li"
              key={item.title}
              delay={i * 0.08}
              className="grid gap-5 rounded-[2rem] bg-card p-7 transition-colors hover:bg-pink/60 sm:grid-cols-[auto_1fr] sm:p-9"
            >
              <img src={item.icon} alt="" aria-hidden="true" width="48" height="48" loading="lazy" className="size-12" />
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-obsidian">{item.title}</h3>
                <p className="mt-3 text-lg text-muted-foreground">{item.description}</p>
              </div>
            </Reveal>
          ))}
          <Reveal as="li" className="rounded-[2rem] bg-obsidian p-7 text-xl font-medium leading-snug text-white sm:p-9 sm:text-2xl">
            La forma más simple de registrar gastos, cumplir presupuestos y entender tus finanzas.
          </Reveal>
        </ul>
      </div>
    </section>
  );
}
