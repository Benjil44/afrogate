import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useLang } from '@/i18n';

export function PromoBar() {
  const { t } = useLang();
  const [open, setOpen] = useState(true);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="animate-gradient-bg relative w-full overflow-hidden bg-[linear-gradient(90deg,var(--secondary),var(--primary),var(--secondary))]"
        >
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
              onClick={() => setOpen(false)}
              aria-label={t.promo.dismiss}
              className="absolute end-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-white/80 transition hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
