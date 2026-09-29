import { Laptop, Monitor, Smartphone, Tablet, WifiOff } from 'lucide-react';
import Reveal from '@/components/common/Reveal';

const PLATFORMS = [
  { icon: Smartphone, label: 'Android' },
  { icon: Smartphone, label: 'iPhone' },
  { icon: Tablet, label: 'Tablet' },
  { icon: Monitor, label: 'Windows' },
  { icon: Laptop, label: 'macOS' },
  { icon: WifiOff, label: 'Sin conexión' },
];

/**
 * Barra bajo el hero (en la plantilla, logos de clientes): dispositivos donde se instala la PWA.
 */
export default function Platforms() {
  return (
    <section className="border-t border-white/10 bg-black py-12 text-white" aria-labelledby="platforms-title">
      <div className="container-page">
        <Reveal as="p" className="text-center text-white/50">
          <span id="platforms-title">Una sola app, instalable en todos tus dispositivos</span>
        </Reveal>
        <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {PLATFORMS.map(({ icon: Icon, label }, i) => (
            <Reveal as="li" key={label} delay={i * 0.05} className="flex items-center justify-center gap-2 text-white/70">
              <Icon className="size-5" aria-hidden="true" />
              <span className="font-medium">{label}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
