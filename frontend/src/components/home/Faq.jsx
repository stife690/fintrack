import SectionHeading from '@/components/common/SectionHeading';
import Reveal from '@/components/common/Reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQS = [
  {
    q: '¿FinTrack tiene algún costo?',
    a: 'No. FinTrack es un proyecto académico y es gratuito.',
  },
  {
    q: '¿Necesito descargarla de una tienda de aplicaciones?',
    a: 'No. Es una aplicación web progresiva (PWA): la abres en el navegador y puedes instalarla en tu pantalla de inicio desde ahí.',
  },
  {
    q: '¿Qué pasa si registro un gasto sin internet?',
    a: 'Se guarda en tu dispositivo y se sincroniza automáticamente con tu cuenta cuando vuelvas a tener conexión.',
  },
  {
    q: '¿Qué hace la inteligencia artificial?',
    a: 'Dos cosas: asigna automáticamente la categoría de cada gasto a partir de su descripción (siempre puedes corregirla) y, con al menos un mes de historial, analiza tus totales por categoría para darte sugerencias de ahorro.',
  },
  {
    q: '¿La IA ve mis datos personales?',
    a: 'No. Solo recibe la descripción del gasto o totales agregados por categoría y mes. Nunca se le envía tu correo, tu identidad ni el detalle de tus transacciones.',
  },
  {
    q: '¿Puedo exportar mis reportes?',
    a: 'Sí. Puedes descargar tus movimientos o el reporte de un periodo en PDF o CSV para compartirlo o guardarlo como respaldo.',
  },
  {
    q: '¿Puedo usarla en varios dispositivos?',
    a: 'Sí. Inicia sesión con la misma cuenta en el celular y en el computador; tus datos se mantienen sincronizados.',
  },
  {
    q: '¿Conecta con mi banco?',
    a: 'Por ahora no. Los movimientos se registran manualmente, lo que te da control total sobre qué información guardas.',
  },
];

/** Preguntas frecuentes en acordeón (la plantilla las usa en sus páginas de pricing). */
export default function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-12 md:py-20 xl:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-[2fr_3fr]">
        <SectionHeading
          align="left"
          eyebrow="FAQ"
          title="Preguntas frecuentes."
          description="Lo esencial para empezar a usar FinTrack."
          className="lg:sticky lg:top-28 lg:self-start"
        />
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible defaultValue="item-0" className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`item-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
