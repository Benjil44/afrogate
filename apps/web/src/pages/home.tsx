import { ScrollProgress } from '@/components/scroll-progress';
import { PromoBar } from '@/components/promo-bar';
import { Nav } from '@/components/nav';
import { MiniPlayer } from '@/components/mini-player';
import { Hero } from '@/sections/hero';
import { Radio } from '@/sections/radio';
import { Features } from '@/sections/features';
import { Pricing } from '@/sections/pricing';
import { Apps } from '@/sections/apps';
import { Faq } from '@/sections/faq';
import { Cta } from '@/sections/cta';
import { Footer } from '@/components/ui/motion-footer';

export function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <ScrollProgress />
      {/* Fixed header: promo bar + nav stacked */}
      <div className="fixed inset-x-0 top-0 z-50">
        <PromoBar />
        <Nav />
      </div>

      <main id="main">
        <Hero />
        <Radio />
        <Features />
        <Pricing />
        <Apps />
        <Faq />
        <Cta />
      </main>

      <Footer />
      <MiniPlayer />
    </div>
  );
}
