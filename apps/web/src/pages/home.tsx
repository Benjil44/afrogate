import { ScrollProgress } from '@/components/scroll-progress';
import { PromoBar } from '@/components/promo-bar';
import { Nav } from '@/components/nav';
import { Hero } from '@/sections/hero';
import { Metrics } from '@/sections/metrics';
import { Features } from '@/sections/features';
import { Gaming } from '@/sections/gaming';
import { AudienceSplit } from '@/sections/audience-split';
import { Pricing } from '@/sections/pricing';
import { Cta } from '@/sections/cta';
import { CinematicFooter } from '@/components/ui/motion-footer';

export function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      <ScrollProgress />
      {/* Fixed header: promo bar + nav stacked */}
      <div className="fixed inset-x-0 top-0 z-50">
        <PromoBar />
        <Nav />
      </div>

      {/* Content scrolls over the fixed footer (curtain reveal). */}
      <main className="relative z-10 rounded-b-3xl border-b border-[var(--border)] bg-background shadow-2xl">
        <Hero />
        <Metrics />
        <Features />
        <Gaming />
        <AudienceSplit />
        <Pricing />
        <Cta />
      </main>

      <CinematicFooter />
    </div>
  );
}
