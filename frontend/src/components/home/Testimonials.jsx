import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import SectionHeading from '@/components/common/SectionHeading';
import Reveal from '@/components/common/Reveal';
import { Button } from '@/components/ui/button';

/** Testimonios de ejemplo (ficticios) para la maqueta de la landing. */
const TESTIMONIALS = [
  {
    photo: '/images/homepage/testimonial-1.webp',
    name: 'Valentina R.',
    role: 'Estudiante universitaria',
    quote: 'Por fin sé cuánto gasto en transporte y comida. Lo registro todo desde el celular, aunque no tenga datos.',
  },
  {
    photo: '/images/homepage/testimonial-2.webp',
    name: 'Andrés M.',
    role: 'Diseñador independiente',
    quote: 'Los presupuestos por categoría me ayudaron a ahorrar para mi primer computador en cuatro meses.',
  },
];

/**
 * Carrusel de testimonios con scroll-snap nativo (liviano, sin librería)
 * y botones anterior/siguiente.
 */
export default function Testimonials() {
  const trackRef = useRef(null);

  const scrollBy = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('li');
    track.scrollBy({ left: direction * (card ? card.offsetWidth + 24 : track.clientWidth), behavior: 'smooth' });
  };

  return (
    <section id="testimonios" className="scroll-mt-20 bg-card py-12 md:py-20 xl:py-32">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            align="left"
            eyebrow="Testimonios"
            title="Pensada para quienes quieren ordenar sus finanzas."
          />
          <div className="flex gap-2">
            <Button variant="outline-light" size="icon" aria-label="Testimonio anterior" onClick={() => scrollBy(-1)}>
              <ChevronLeft />
            </Button>
            <Button variant="outline-light" size="icon" aria-label="Testimonio siguiente" onClick={() => scrollBy(1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        <ul
          ref={trackRef}
          className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TESTIMONIALS.map((t, i) => (
            <Reveal
              as="li"
              key={t.name}
              delay={i * 0.1}
              className="grid w-[88%] shrink-0 snap-start overflow-hidden rounded-3xl bg-white sm:grid-cols-[2fr_3fr] md:w-[70%] lg:w-[62%]"
            >
              <img
                src={t.photo}
                alt={`Foto de ${t.name}`}
                width="720"
                height="759"
                loading="lazy"
                decoding="async"
                className="h-64 w-full object-cover sm:h-full"
              />
              <div className="flex flex-col justify-between gap-8 p-6 sm:p-8">
                <Quote className="size-8 fill-violet text-violet" aria-hidden="true" />
                <blockquote className="text-xl font-medium leading-snug text-obsidian md:text-2xl">“{t.quote}”</blockquote>
                <div>
                  <div className="flex gap-0.5" aria-label="5 de 5 estrellas">
                    {Array.from({ length: 5 }, (_, k) => (
                      <Star key={k} className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    ))}
                  </div>
                  <p className="mt-3 font-semibold text-obsidian">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
