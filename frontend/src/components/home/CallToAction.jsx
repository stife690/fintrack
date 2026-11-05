import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/common/Reveal';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/common/Logo';

/** Cierre violeta a todo el ancho: el logo, la invitación y las dos acciones. */
export default function CallToAction() {
  return (
    <section id="empieza" className="scroll-mt-20 bg-[linear-gradient(to_bottom,#fff,#6142ff_10rem)] pb-24 pt-40 text-white md:pb-32 md:pt-48">
      <Reveal className="container-page flex flex-col items-center text-center">
        <LogoMark
          tone="light"
          className="size-20 rounded-[1.4rem] shadow-[0_18px_40px_-12px_rgba(28,18,72,0.7)] ring-4 ring-white/50"
        />
        <h2 className="mt-8 max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-7xl">
          Empieza a controlar tus gastos hoy.
        </h2>
        <p className="mt-6 text-lg text-white/80 md:text-xl">Crea tu cuenta en menos de un minuto. Sin tarjeta, sin letra pequeña.</p>
        <div className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-14 rounded-full bg-white px-8 text-lg text-violet hover:bg-white/90 motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
          >
            <Link to="/registro">
              Crear cuenta gratis <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-14 rounded-full border-white/40 px-8 text-lg text-white hover:bg-white/10">
            <Link to="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
