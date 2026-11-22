import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Overlay } from '@/components/overlay';
import { PromoBar } from '@/components/promo-bar';
import { useLang } from '@/i18n';
import { Apps } from '@/sections/apps';
import { Faq } from '@/sections/faq';
import { Pricing } from '@/sections/pricing';

/**
 * "Get Afrows VPN": full-height sheet from the inline-end edge holding the existing promo bar,
 * pricing, apps and FAQ sections (moved from the old landing page). It scrolls in its own
 * container; the music keeps playing underneath. `#vpn` and `#pricing` deep links open it
 * (`focusPricing` scrolls the plans into view).
 */
export function VpnSheet({ open, onClose, focusPricing }: { open: boolean; onClose: () => void; focusPricing: boolean }) {
  const { t } = useLang();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const target = focusPricing ? scroller.querySelector<HTMLElement>('#pricing') : null;
      scroller.scrollTop = target ? target.offsetTop : 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, focusPricing]);

  return (
    <Overlay open={open} onClose={onClose} variant="side" labelledBy="vpn-sheet-title" initialFocus={closeRef}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4">
        <h2 id="vpn-sheet-title" className="text-base font-black">
          {t.player.vpnTitle}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t.player.close}
          className="grid h-11 w-11 place-items-center rounded-full text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div ref={scrollRef} className="scroll-area relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PromoBar />
        <Pricing />
        <Apps />
        <Faq />
      </div>
    </Overlay>
  );
}
