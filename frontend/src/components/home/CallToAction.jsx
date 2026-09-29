import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/common/Reveal';
import { Button } from '@/components/ui/button';

/** Bloque final oscuro con brillo violeta que invita a registrarse. */
export default function CallToAction() {
  return (
    <section className="pb-12 md:pb-20 xl:pb-32">
      <div className="container-page">
        <Reveal className="relative overflow-hidden rounded-3xl bg-black px-6 py-16 text-center text-white md:px-12 md:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 left-1/2 size-[460px] -translate-x-1/2 rounded-full bg-violet/40 blur-[120px]"
          />
          <div className="relative mx-auto max-w-2xl space-y-6">
            <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Empieza a controlar tus gastos hoy.
            </h2>
            <p className="text-lg text-white/60">Crea tu cuenta en menos de un minuto. Sin tarjeta, sin letra pequeña.</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/registro">
                  Crear cuenta gratis <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
