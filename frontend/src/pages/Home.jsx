import { MotionConfig } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import Platforms from '@/components/home/Platforms';
import CoreFeatures from '@/components/home/CoreFeatures';
import Highlights from '@/components/home/Highlights';
import MobileApp from '@/components/home/MobileApp';
import Security from '@/components/home/Security';
import Faq from '@/components/home/Faq';
import CallToAction from '@/components/home/CallToAction';
import usePageTitle from '@/hooks/usePageTitle';

/**
 * Landing de FinTrack con la línea gráfica de la plantilla Revio.
 * `MotionConfig` desactiva las animaciones si el sistema pide movimiento reducido.
 */
export default function Home() {
  usePageTitle('Controla tus gastos');
  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-obsidian"
      >
        Saltar al contenido
      </a>
      <Navbar />
      {/* Fondo blanco propio: el body es negro (por el rebote del scroll en celular) y las secciones
          claras no traen fondo, así que sus títulos oscuros quedaban sobre negro. */}
      <main id="contenido" className="bg-background">
        <Hero />
        <Platforms />
        <CoreFeatures />
        <Highlights />
        <MobileApp />
        <Security />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </MotionConfig>
  );
}
