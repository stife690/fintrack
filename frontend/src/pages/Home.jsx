import { MotionConfig } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroStage from '@/components/home/HeroStage';
import Features from '@/components/home/Features';
import Alerts from '@/components/home/Alerts';
import AppDevices from '@/components/home/AppDevices';
import Privacy from '@/components/home/Privacy';
import Faq from '@/components/home/Faq';
import CallToAction from '@/components/home/CallToAction';
import GuidedTour from '@/components/home/tour/GuidedTour';
import usePageTitle from '@/hooks/usePageTitle';

/**
 * Landing de FinTrack: escenario 3D (hero, "Qué es" y "Cómo funciona"), funcionalidades,
 * alertas, app instalable, seguridad, preguntas y cierre.
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
      <GuidedTour>
        <Navbar />
        {/* Fondo blanco propio: el body es negro (por el rebote del scroll en celular). */}
        <main id="contenido" className="bg-background">
          <HeroStage />
          <Features />
          <Alerts />
          <AppDevices />
          <Privacy />
          <Faq />
          <CallToAction />
        </main>
        <Footer />
      </GuidedTour>
    </MotionConfig>
  );
}
