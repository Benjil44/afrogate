import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Collapse } from '@/components/collapse';
import { useLang } from '@/i18n';
import { useMotion } from '@/motion/provider';

export function PromoBar() {
  const { t } = useLang();
  const { refresh } = useMotion();
  const [open, setOpen] = useState(true);

  const dismiss = () => {
    setOpen(false);
    // The fixed header gets shorter: re-measure scroll positions once the collapse has settled.
    window.setTimeout(refresh, 400);
  };

  return (
    <Collapse open={open} className="w-full">
      <div className="animate-gradient-bg relative w-full bg-[linear-gradient(90deg,var(--secondary),var(--primary),var(--secondary))]">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-12 py-2 text-sm text-white">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline">
            {t.promo.tag}
          </span>
          <span className="truncate font-bold">{t.promo.text}</span>
          <a
            href="#pricing"
            className="hidden shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#120f18] transition hover:brightness-90 sm:inline-block"
          >
            {t.promo.cta}
          </a>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.promo.dismiss}
            className="absolute end-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-white/80 transition hover:text-white focus-visible:outline-offset-[-6px] focus-visible:outline-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Collapse>
  );
}
