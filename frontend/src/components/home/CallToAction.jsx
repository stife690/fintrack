import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/common/Reveal';
import { Button } from '@/components/ui/button';
import { ReceiptPaper, ReceiptRow, ReceiptStamp } from './Receipt';

/** Bloque final violeta: la tirilla cierra la cuenta en $0 y el sello dice "gratis". */
export default function CallToAction() {
  return (
    <section className="pb-16 md:pb-24 xl:pb-32">
      <div className="container-page">
        <Reveal className="relative grid items-center gap-12 overflow-hidden rounded-[2rem] bg-violet px-6 py-14 text-white md:px-14 md:py-20 lg:grid-cols-[1.3fr_1fr]">
          <div className="relative space-y-6 text-center lg:text-left">
            <h2 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-6xl">
              Empieza a controlar tus gastos hoy.
            </h2>
            <p className="text-lg text-white/80 md:text-xl">Crea tu cuenta en menos de un minuto. Sin tarjeta, sin letra pequeña.</p>
            <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row lg:justify-start">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-7 text-violet hover:bg-white/90 motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
              >
                <Link to="/registro">
                  Crear cuenta gratis <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-white/40 text-white hover:bg-white/10"
              >
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[300px] rotate-2">
            <ReceiptPaper>
              <p className="pt-1 text-xl font-bold tracking-tight">FINTRACK</p>
              <p className="mb-6 text-xs text-obsidian/60">Tu cuenta nueva</p>
              <ReceiptRow label="Registro" value="1 min" />
              <ReceiptRow label="Tarjeta" value="No" />
              <ReceiptRow strong label="Total a pagar" value="$0" className="mt-3" />
              <p className="mt-4 text-center text-xs text-obsidian/60">Proyecto académico</p>
            </ReceiptPaper>
            <ReceiptStamp className="absolute right-2 top-2">Gratis</ReceiptStamp>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
