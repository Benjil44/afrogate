import { ScrollProgress } from '@/components/scroll-progress';
import { PromoBar } from '@/components/promo-bar';
import { Nav } from '@/components/nav';
import { MiniPlayer } from '@/components/mini-player';
import { Hero } from '@/sections/hero';
import { Radio } from '@/sections/radio';
import { Deck } from '@/sections/deck';
import { Features } from '@/sections/features';
import { Apps } from '@/sections/apps';
import { Pricing } from '@/sections/pricing';
import { Faq } from '@/sections/faq';
import { Cta } from '@/sections/cta';
import { Footer } from '@/components/ui/motion-footer';

/**
 * One scroll = tuning in to a station (docs/landing-wave-station-story.md):
 * Hero (signal) -> Stations -> Deck (real sound) -> Clean signal -> Receivers -> Your frequency -> FAQ -> Go on air -> sign-off.
 */
export function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <ScrollProgress />
      {/* Fixed header: promo bar + nav stacked; measured by the motion provider for anchor offsets */}
      <div data-site-header className="fixed inset-x-0 top-0 z-50">
        <PromoBar />
        <Nav />
      </div>

      <main id="main">
        <Hero />
        <Radio />
        <Deck />
        <Features />
        <Apps />
        <Pricing />
        <Faq />
        <Cta />
      </main>

      <Footer />
      <MiniPlayer />
    </div>
  );
}
