import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import Platforms from '@/components/home/Platforms';
import CoreFeatures from '@/components/home/CoreFeatures';
import Highlights from '@/components/home/Highlights';
import MobileApp from '@/components/home/MobileApp';
import Security from '@/components/home/Security';
import Testimonials from '@/components/home/Testimonials';
import Faq from '@/components/home/Faq';
import CallToAction from '@/components/home/CallToAction';
import usePageTitle from '@/hooks/usePageTitle';

/** Landing de FinTrack con la línea gráfica de la plantilla Revio. */
export default function Home() {
  usePageTitle('Controla tus gastos');
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-obsidian"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido">
        <Hero />
        <Platforms />
        <CoreFeatures />
        <Highlights />
        <MobileApp />
        <Security />
        <Testimonials />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
}
